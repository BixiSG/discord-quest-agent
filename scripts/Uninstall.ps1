<#
.SYNOPSIS
    Removes Discord Quest Agent completely: running agent processes, the agent
    living inside Discord, shortcuts and the install folder.

.PARAMETER KeepConfig
    Leave config.json in place (everything else is removed).

.PARAMETER KeepDiscord
    Do not restart Discord. The injected agent then stays alive until Discord
    is next restarted, and the debugging port stays open until then too.

.NOTES
    Keep this file pure ASCII - PowerShell 5.1 reads BOM-less scripts as ANSI.
#>
param([switch]$KeepConfig, [switch]$KeepDiscord, [switch]$Quiet)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$InstallDir = Join-Path $env:LOCALAPPDATA "DiscordQuestAgent"
$StartupDir = [Environment]::GetFolderPath("Startup")
$StartupLnk = Join-Path $StartupDir "Discord Quest Agent.lnk"
$StartMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "Discord Quest Agent"

function Say { param([string]$m, [string]$c = "Gray") if (-not $Quiet) { Write-Host $m -ForegroundColor $c } }

Say ""
Say "  Discord Quest Agent - uninstaller" "Cyan"
Say ""

# Never sit inside the folder we are about to delete.
try { Set-Location -Path $env:TEMP } catch { }

# ---- 1. Stop resident agent processes (from any install location) ------------
$killed = 0
Get-CimInstance Win32_Process -Filter "Name like '%powershell%'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'QuestAgent\.ps1' -and $_.ProcessId -ne $PID } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $killed++ }
Say "Stopped $killed running agent process(es)."

# ---- 2. Shortcuts --------------------------------------------------------------
Remove-Item -Path $StartupLnk -Force -ErrorAction SilentlyContinue
Remove-Item -Path $StartMenu -Recurse -Force -ErrorAction SilentlyContinue
Say "Removed shortcuts."

# ---- 3. Get the agent out of Discord --------------------------------------------
# The injected script lives in Discord's renderer, so the only way to be rid of
# it (and of the open debugging port) is to restart Discord without the flag.
$DiscordBranches = @(
    [pscustomobject]@{ Proc = "Discord";       Dir = "$env:LOCALAPPDATA\Discord" }
    [pscustomobject]@{ Proc = "DiscordPTB";    Dir = "$env:LOCALAPPDATA\DiscordPTB" }
    [pscustomobject]@{ Proc = "DiscordCanary"; Dir = "$env:LOCALAPPDATA\DiscordCanary" }
)

# Main Discord processes started with a debugging port: [{Proc, Port}]
function Get-DebuggableDiscord {
    $out = @()
    foreach ($b in $DiscordBranches) {
        Get-CimInstance Win32_Process -Filter "Name = '$($b.Proc).exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -notmatch '--type=' -and $_.CommandLine -match '--remote-debugging-port=(\d+)' } |
            ForEach-Object { $out += [pscustomobject]@{ Proc = $b.Proc; Dir = $b.Dir; Port = [int]$Matches[1] } }
    }
    return $out
}

function Invoke-CdpEval {
    param([string]$WsUrl, [string]$Expression)
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [System.Threading.CancellationToken]::None
    try {
        $ws.ConnectAsync([Uri]$WsUrl, $ct).Wait(3000) | Out-Null
        $payload = @{ id = 1; method = "Runtime.evaluate"; params = @{ expression = $Expression; returnByValue = $true } } |
            ConvertTo-Json -Depth 5 -Compress
        $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
        $seg = New-Object System.ArraySegment[byte] (, $bytes)
        $ws.SendAsync($seg, [Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait(3000) | Out-Null
        $buf = New-Object byte[] 65536
        $rseg = New-Object System.ArraySegment[byte] (, $buf)
        $ws.ReceiveAsync($rseg, $ct).Wait(3000) | Out-Null
    } finally {
        try { $ws.CloseAsync([Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", $ct).Wait(1000) | Out-Null } catch { }
        $ws.Dispose()
    }
}

# Best effort: tell the agent to stop (removes the HUD, cancels tasks) before
# the restart, so nothing keeps beating against Discord's API meanwhile.
function Stop-InjectedAgent {
    param([int]$Port)
    try {
        $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json" -TimeoutSec 3
        foreach ($p in @($targets | Where-Object { $_.type -eq "page" -and $_.webSocketDebuggerUrl })) {
            try { Invoke-CdpEval -WsUrl $p.webSocketDebuggerUrl -Expression "try { window.__questAgent && window.__questAgent.stop && window.__questAgent.stop() } catch (e) {} ; true" } catch { }
        }
    } catch { }
}

function Restart-DiscordClean {
    param($Info)
    Stop-InjectedAgent -Port $Info.Port
    $procs = @(Get-Process -Name $Info.Proc -ErrorAction SilentlyContinue)
    foreach ($p in $procs) { try { [void]$p.CloseMainWindow() } catch { } }
    for ($i = 0; $i -lt 16; $i++) {
        Start-Sleep -Milliseconds 500
        if (-not @(Get-Process -Name $Info.Proc -ErrorAction SilentlyContinue).Count) { break }
    }
    Get-Process -Name $Info.Proc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    $updater = Join-Path $Info.Dir "Update.exe"
    if (Test-Path $updater) {
        # Discord's own launch path, no debugging flag.
        Start-Process -FilePath $updater -ArgumentList @("--processStart", "$($Info.Proc).exe") | Out-Null
        return $true
    }
    return $false
}

$debuggable = @(Get-DebuggableDiscord)
if ($debuggable.Count -eq 0) {
    Say "Discord is not running with a debugging port - nothing to clean up there."
} elseif ($KeepDiscord) {
    Say "Discord is running with the debugging port (-KeepDiscord: leaving it)." "Yellow"
    Say "The agent stays inside Discord until you restart Discord yourself." "DarkGray"
} else {
    foreach ($d in $debuggable) {
        Say "Restarting $($d.Proc) without the debugging port ..."
        if (Restart-DiscordClean $d) { Say "$($d.Proc) restarted clean." }
        else { Say "$($d.Proc) closed; Update.exe not found, start it from its own shortcut." "Yellow" }
    }
}

# ---- 4. Install folder ----------------------------------------------------------
function Remove-WithRetry {
    param([string]$Path, [switch]$SkipConfig)
    for ($i = 0; $i -lt 6; $i++) {
        if ($SkipConfig) {
            Get-ChildItem -Path $Path -Force -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -ne "config.json" } |
                Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
            $left = @(Get-ChildItem -Path $Path -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne "config.json" })
            if ($left.Count -eq 0) { return $true }
        } else {
            Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue
            if (-not (Test-Path -LiteralPath $Path)) { return $true }
        }
        Start-Sleep -Seconds 1
    }
    return $false
}

if (Test-Path -LiteralPath $InstallDir) {
    if ($KeepConfig -and (Test-Path (Join-Path $InstallDir "config.json"))) {
        if (Remove-WithRetry -Path $InstallDir -SkipConfig) { Say "Removed program files (config.json kept)." }
        else { Say "Could not remove everything under $InstallDir - delete it by hand." "Red" }
    } else {
        if (Remove-WithRetry -Path $InstallDir) { Say "Removed $InstallDir." }
        else { Say "Could not remove $InstallDir - delete the folder by hand." "Red" }
    }
} else {
    Say "Install folder already gone."
}

# ---- 5. Anything else on this PC that would bring an agent back? ------------------
# Not ours to delete, but worth knowing about: a Startup shortcut or Run entry
# that starts Discord with a debugging port, or that mentions a quest agent.
$Signature = 'QuestAgent|quest-agent|QuestBypass|quest-bypass|remote-debugging-port'
function Test-LauncherMatch {
    param([string]$Target, [string]$Arguments)
    if (("$Target $Arguments") -match $Signature) { return $true }
    # A shortcut that runs a script: peek inside the script, and inside the
    # scripts next to it (a .vbs stub that hides a .ps1 is the common layout).
    $file = $null
    if ($Target -match '\.(ps1|bat|cmd|vbs|js)$') { $file = $Target }
    elseif ($Arguments -match '"?([A-Za-z]:\\[^"]+\.(ps1|bat|cmd|vbs|js))"?') { $file = $Matches[1] }
    if (-not $file -or -not (Test-Path -LiteralPath $file)) { return $false }
    $candidates = @(Get-Item -LiteralPath $file -ErrorAction SilentlyContinue)
    $candidates += @(Get-ChildItem -LiteralPath (Split-Path -Parent $file) -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -match '^\.(ps1|bat|cmd|vbs|js)$' -and $_.Length -lt 1MB } | Select-Object -First 25)
    foreach ($c in $candidates) {
        try { if ((Get-Content -LiteralPath $c.FullName -Raw -ErrorAction Stop) -match $Signature) { return $true } } catch { }
    }
    return $false
}

$foreign = @()
# Live right now: a script host whose command line points at an agent or a
# debugging port (our own QuestAgent.ps1 processes were stopped above).
Get-CimInstance Win32_Process -Filter "Name like '%powershell%' or Name like '%wscript%' or Name like '%cscript%' or Name like '%cmd.exe%'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match $Signature -and $_.CommandLine -notmatch 'Uninstall\.ps1' } |
    ForEach-Object { $foreign += "Running process $($_.ProcessId): $($_.CommandLine)" }
try {
    $shell = New-Object -ComObject WScript.Shell
    foreach ($lnk in @(Get-ChildItem -Path $StartupDir -Filter *.lnk -ErrorAction SilentlyContinue)) {
        try {
            $sc = $shell.CreateShortcut($lnk.FullName)
            if (Test-LauncherMatch -Target $sc.TargetPath -Arguments $sc.Arguments) { $foreign += "Startup shortcut: $($lnk.FullName)" }
        } catch { }
    }
} catch { }
try {
    $run = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -ErrorAction Stop
    foreach ($p in $run.PSObject.Properties) {
        if ($p.Name -like "PS*") { continue }
        if (Test-LauncherMatch -Target "" -Arguments ([string]$p.Value)) { $foreign += "Registry Run entry '$($p.Name)': $($p.Value)" }
    }
} catch { }

Say ""
if ($foreign.Count) {
    Say "  WARNING: other startup items on this PC start Discord with a debugging" "Yellow"
    Say "  port or run a quest agent. They were NOT installed by this tool and" "Yellow"
    Say "  were left alone. Remove them yourself or the agent will be back:" "Yellow"
    foreach ($f in $foreign) { Say "    - $f" "Yellow" }
    Say ""
}
Say "  Done. Discord Quest Agent is uninstalled." "Green"
Say ""
