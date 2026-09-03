<#
.SYNOPSIS
    Discord Quest Agent - completes Discord quests automatically and shows an
    in-client HUD. No Vencord, no plugins, no rebuilds.

.DESCRIPTION
    Launches (or attaches to) the Discord desktop client with a localhost-only
    debugging port, injects quest-agent.js into its renderer, and stays resident
    to re-inject after reloads or Discord updates.

.PARAMETER Branch
    Auto (default), Stable, Ptb or Canary. Auto picks the running client, else
    the only one installed.

.PARAMETER Port
    Debug port. 0 (default) uses the value from config.json, which the installer
    randomises per machine.

.PARAMETER AttachOnly
    Never launch or restart Discord; only attach to one that already has the port.

.PARAMETER NoWatch
    Inject once and exit instead of staying resident.

.PARAMETER NoUpdate
    Skip the update check for this run.

.PARAMETER Diagnose
    Print a support report (versions, config, agent state, quest summary) and exit.
    Paste this into a GitHub issue.

.NOTES
    Keep this file pure ASCII - PowerShell 5.1 reads BOM-less scripts as ANSI.
#>
[CmdletBinding()]
param(
    [ValidateSet("Auto", "Stable", "Ptb", "Canary")]
    [string]$Branch = "Auto",
    [int]$Port = 0,
    [switch]$AttachOnly,
    [switch]$NoWatch,
    [switch]$NoUpdate,
    [switch]$Diagnose
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Root = Split-Path -Parent $PSScriptRoot          # install root (parent of src\)
if (-not (Test-Path (Join-Path $Root "VERSION"))) { $Root = $PSScriptRoot }
$AgentJs = Join-Path $PSScriptRoot "quest-agent.js"
$ConfigPath = Join-Path $Root "config.json"
$LogPath = Join-Path $Root "quest-agent.log"

function Write-Log {
    param([string]$Message, [string]$Color = "Gray")
    $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message
    Write-Host $line -ForegroundColor $Color
    try { Add-Content -Path $LogPath -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue } catch { }
}

# ---- Config -----------------------------------------------------------------
$DefaultConfig = [ordered]@{
    repo            = "BixiSG/discord-quest-agent"
    autoUpdate      = $true
    port            = 9333
    branch          = "Auto"
    restartDiscord  = $true
    autoEnroll      = $true
    scanIntervalMs  = 120000
    maxTaskAttempts = 3
    hud             = $true
    notify          = $true
}

function Get-Config {
    # [ordered] yields an OrderedDictionary, which has no Clone() on PS 5.1.
    $cfg = [ordered]@{}
    foreach ($k in $DefaultConfig.Keys) { $cfg[$k] = $DefaultConfig[$k] }
    if (Test-Path $ConfigPath) {
        try {
            $raw = Get-Content -Raw -Path $ConfigPath -Encoding UTF8 | ConvertFrom-Json
            foreach ($k in @($cfg.Keys)) {
                if ($null -ne $raw.$k) { $cfg[$k] = $raw.$k }
            }
        } catch { Write-Log "config.json is invalid, using defaults: $($_.Exception.Message)" "Yellow" }
    }
    return $cfg
}

$cfg = Get-Config
if ($Port -le 0) { $Port = [int]$cfg.port }
if ($Branch -eq "Auto" -and $cfg.branch -ne "Auto") { $Branch = [string]$cfg.branch }
$cdpBase = "http://127.0.0.1:$Port"

# ---- Discord discovery ------------------------------------------------------
$Branches = @(
    [pscustomobject]@{ Name = "Stable"; Dir = "$env:LOCALAPPDATA\Discord";      Proc = "Discord";       Data = "$env:APPDATA\discord" }
    [pscustomobject]@{ Name = "Ptb";    Dir = "$env:LOCALAPPDATA\DiscordPTB";   Proc = "DiscordPTB";    Data = "$env:APPDATA\discordptb" }
    [pscustomobject]@{ Name = "Canary"; Dir = "$env:LOCALAPPDATA\DiscordCanary";Proc = "DiscordCanary"; Data = "$env:APPDATA\discordcanary" }
)

function Resolve-Branch {
    if ($Branch -ne "Auto") {
        $b = $Branches | Where-Object Name -eq $Branch
        if (-not $b) { throw "Unknown branch: $Branch" }
        return $b
    }
    $running = $Branches | Where-Object { Get-Process -Name $_.Proc -ErrorAction SilentlyContinue }
    if ($running) { return @($running)[0] }
    $installed = $Branches | Where-Object { Test-Path $_.Dir }
    if (-not $installed) { throw "No Discord installation found under %LOCALAPPDATA%." }
    return @($installed)[0]
}

# Files Electron cannot boot without. Discord's host updater builds the new
# app-<version> folder incrementally - Discord.exe and a couple of .pak files
# land first, resources\, locales\, modules\ and the runtime blobs come later.
# So "Discord.exe exists" does NOT mean the folder is runnable, and an update
# that gets interrupted leaves a permanently unusable app-<version> behind.
# Launching one of those is an instant crash on start, which is exactly what
# this list is here to prevent.
$CoreBuildFiles = @("resources.pak", "icudtl.dat", "v8_context_snapshot.bin", "snapshot_blob.bin", "ffmpeg.dll")

function Test-DiscordAppComplete {
    param([string]$AppDir, [string]$ProcName)
    if (-not (Test-Path (Join-Path $AppDir "$ProcName.exe"))) { return $false }
    if (-not (Test-Path (Join-Path $AppDir "resources"))) { return $false }
    foreach ($f in $CoreBuildFiles) {
        if (-not (Test-Path (Join-Path $AppDir $f))) { return $false }
    }
    return $true
}

# Newest first. The name filter keeps a stray app-<something> from throwing in
# the [version] cast and taking the whole sort down with it.
function Get-DiscordAppDirs {
    param($BranchInfo)
    return @(Get-ChildItem -Path $BranchInfo.Dir -Filter "app-*" -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^app-\d+(\.\d+)*$' } |
        Sort-Object { [version]($_.Name -replace '^app-', '') } -Descending)
}

function Get-DiscordExe {
    param($BranchInfo)
    foreach ($app in Get-DiscordAppDirs $BranchInfo) {
        if (Test-DiscordAppComplete -AppDir $app.FullName -ProcName $BranchInfo.Proc) {
            return (Join-Path $app.FullName "$($BranchInfo.Proc).exe")
        }
        Write-Log "Skipping $($app.Name): incomplete build (interrupted Discord update)." "DarkGray"
    }
    return $null
}

# Discord's own shortcut runs Update.exe, which resolves the active version from
# installer.db. Going through it means we can never pick the wrong app folder,
# and it keeps working across future updates.
function Get-DiscordUpdateExe {
    param($BranchInfo)
    $u = Join-Path $BranchInfo.Dir "Update.exe"
    if (Test-Path $u) { return $u }
    return $null
}

# True while Discord's updater is downloading or applying a build. Force-killing
# the client during that window is what corrupts an app-<version> folder in the
# first place, so we back off instead.
function Test-DiscordUpdating {
    param($BranchInfo)
    $log = Join-Path $BranchInfo.Data "logs\Discord_updater_rCURRENT.log"
    if (Test-Path $log) {
        try {
            if (((Get-Date) - (Get-Item $log).LastWriteTime).TotalSeconds -lt 90) { return $true }
        } catch { }
    }
    $incoming = Join-Path $BranchInfo.Dir "download\incoming"
    if (Test-Path $incoming) {
        if (@(Get-ChildItem -Path $incoming -Force -ErrorAction SilentlyContinue).Count -gt 0) { return $true }
    }
    return $false
}

# Ask Discord to close before reaching for Stop-Process, so it gets the chance
# to finish whatever it was writing.
function Stop-Discord {
    param($BranchInfo)
    $procs = @(Get-Process -Name $BranchInfo.Proc -ErrorAction SilentlyContinue)
    if (-not $procs.Count) { return }
    foreach ($p in $procs) { try { [void]$p.CloseMainWindow() } catch { } }
    for ($i = 0; $i -lt 16; $i++) {
        Start-Sleep -Milliseconds 500
        if (-not @(Get-Process -Name $BranchInfo.Proc -ErrorAction SilentlyContinue).Count) { return }
    }
    Write-Log "Discord did not close on request; forcing it." "DarkGray"
    Get-Process -Name $BranchInfo.Proc -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
}

function Test-CdpUp {
    try { Invoke-RestMethod -Uri "$cdpBase/json/version" -TimeoutSec 2 | Out-Null; return $true }
    catch { return $false }
}

# ---- CDP --------------------------------------------------------------------
function Invoke-CdpEval {
    param([string]$WsUrl, [string]$Expression, [bool]$ReturnByValue = $false)
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [System.Threading.CancellationToken]::None
    try {
        $ws.ConnectAsync([Uri]$WsUrl, $ct).Wait()
        $payload = @{
            id     = 1
            method = "Runtime.evaluate"
            params = @{ expression = $Expression; awaitPromise = $false; userGesture = $true; returnByValue = $ReturnByValue }
        } | ConvertTo-Json -Depth 6 -Compress

        $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
        $seg = New-Object System.ArraySegment[byte] (, $bytes)
        $ws.SendAsync($seg, [Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

        $buf = New-Object byte[] 65536
        while ($true) {
            $sb = New-Object Text.StringBuilder
            do {
                $rseg = New-Object System.ArraySegment[byte] (, $buf)
                $t = $ws.ReceiveAsync($rseg, $ct); $t.Wait()
                [void]$sb.Append([Text.Encoding]::UTF8.GetString($buf, 0, $t.Result.Count))
            } while (-not $t.Result.EndOfMessage)
            $msg = $sb.ToString()
            if ($msg -match '"id"\s*:\s*1\b') { return $msg }
        }
    } finally {
        try { $ws.CloseAsync([Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", $ct).Wait() } catch { }
        $ws.Dispose()
    }
}

function Find-DiscordTarget {
    try { $targets = Invoke-RestMethod -Uri "$cdpBase/json" -TimeoutSec 5 } catch { return $null }
    foreach ($p in @($targets | Where-Object { $_.type -eq "page" -and $_.webSocketDebuggerUrl })) {
        try {
            $r = Invoke-CdpEval -WsUrl $p.webSocketDebuggerUrl -Expression "typeof webpackChunkdiscord_app !== 'undefined'" -ReturnByValue $true
            if ($r -match '"value"\s*:\s*true') { return $p }
        } catch { }
    }
    return $null
}

function Get-AgentPayload {
    if (-not (Test-Path $AgentJs)) { throw "quest-agent.js not found at $AgentJs" }
    # -Encoding UTF8 is required: PS 5.1 otherwise decodes as system ANSI and
    # mangles any non-ASCII byte before it reaches Discord.
    $js = Get-Content -Raw -Path $AgentJs -Encoding UTF8
    $runtime = [ordered]@{
        autoEnroll      = [bool]$cfg.autoEnroll
        scanIntervalMs  = [int]$cfg.scanIntervalMs
        maxTaskAttempts = [int]$cfg.maxTaskAttempts
        hud             = [bool]$cfg.hud
        notify          = [bool]$cfg.notify
    } | ConvertTo-Json -Compress
    return "window.__questAgentConfig = $runtime;`n$js"
}

# Returns: notarget | present | injected | error
function Invoke-Injection {
    $t = Find-DiscordTarget
    if (-not $t) { return "notarget" }
    try {
        $r = Invoke-CdpEval -WsUrl $t.webSocketDebuggerUrl -Expression "typeof window.__questAgent !== 'undefined'" -ReturnByValue $true
        if ($r -match '"value"\s*:\s*true') { return "present" }
        $resp = Invoke-CdpEval -WsUrl $t.webSocketDebuggerUrl -Expression (Get-AgentPayload)
        if ($resp -match '"exceptionDetails"') {
            Write-Log "Discord reported an error running the agent:" "Red"
            Write-Log $resp "DarkGray"
            return "error"
        }
        return "injected"
    } catch { return "notarget" }
}

# ---- Updater ----------------------------------------------------------------
# A UTF-8 BOM survives both Get-Content and Invoke-WebRequest as a literal U+FEFF,
# which String.Trim() does NOT strip. Left in, it breaks the [version] cast and
# silently downgrades the comparison to string inequality.
function Format-VersionString {
    param([string]$Value)
    if ($null -eq $Value) { return "" }
    return $Value.Trim([char]0xFEFF, [char]0x200B, ' ', "`t", "`r", "`n")
}

function Get-LocalVersion {
    $f = Join-Path $Root "VERSION"
    if (Test-Path $f) { return Format-VersionString (Get-Content -Raw -Path $f -Encoding UTF8) }
    return "0.0.0"
}

function Invoke-SelfUpdate {
    if (-not $cfg.autoUpdate -or $NoUpdate) { return $false }
    $repo = [string]$cfg.repo
    if ([string]::IsNullOrWhiteSpace($repo) -or $repo -notmatch '^[^/]+/[^/]+$') { return $false }
    try {
        $remote = Format-VersionString (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/$repo/main/VERSION" `
            -UseBasicParsing -TimeoutSec 10).Content
    } catch {
        Write-Log "Update check skipped (offline or repo unreachable)." "DarkGray"
        return $false
    }
    $local = Get-LocalVersion
    try { $newer = [version]$remote -gt [version]$local } catch { $newer = ($remote -ne $local) }
    if (-not $newer) { Write-Log "Up to date (v$local)." "DarkGray"; return $false }

    Write-Log "Update available: v$local -> v$remote. Downloading..." "Cyan"
    $tmp = Join-Path $env:TEMP ("dqa-" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    try {
        $zip = Join-Path $tmp "src.zip"
        Invoke-WebRequest -Uri "https://github.com/$repo/archive/refs/heads/main.zip" -OutFile $zip -UseBasicParsing -TimeoutSec 60
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [IO.Compression.ZipFile]::ExtractToDirectory($zip, $tmp)
        $extracted = Get-ChildItem -Path $tmp -Directory | Select-Object -First 1
        if (-not $extracted) { throw "archive was empty" }

        # Never overwrite the user's config.json.
        foreach ($item in @("src", "scripts", "VERSION", "README.md", "Install.bat", "Uninstall.bat", "Start-QuestAgent.bat")) {
            $from = Join-Path $extracted.FullName $item
            if (Test-Path $from) {
                Copy-Item -Path $from -Destination $Root -Recurse -Force
            }
        }
        Write-Log "Updated to v$remote. Restarting..." "Green"
        return $true
    } catch {
        Write-Log "Update failed, continuing on v$local : $($_.Exception.Message)" "Yellow"
        return $false
    } finally {
        Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# ---- Diagnose ---------------------------------------------------------------
function Invoke-Diagnose {
    $b = try { Resolve-Branch } catch { $null }
    Write-Host "=== Discord Quest Agent diagnostics ===" -ForegroundColor Cyan
    Write-Host "Tool version : $(Get-LocalVersion)"
    Write-Host "PowerShell   : $($PSVersionTable.PSVersion)"
    Write-Host "OS           : $([Environment]::OSVersion.VersionString)"
    Write-Host "Install root : $Root"
    Write-Host "Branch       : $(if ($b) { $b.Name } else { 'not found' })"
    Write-Host "Discord exe  : $(if ($b) { $(Get-DiscordExe $b) } else { 'n/a' })"
    if ($b) {
        # An interrupted Discord update leaves a newer-but-unusable app-<version>
        # on disk. Naming it here turns a baffling crash-on-start into one line.
        foreach ($app in Get-DiscordAppDirs $b) {
            $ok = Test-DiscordAppComplete -AppDir $app.FullName -ProcName $b.Proc
            Write-Host ("Build        : {0} - {1}" -f $app.Name, $(if ($ok) { "complete" } else { "INCOMPLETE (interrupted update, ignored)" }))
        }
        Write-Host "Updating now : $(Test-DiscordUpdating $b)"
    }
    Write-Host "Discord procs: $((Get-Process -Name Discord*, DiscordPTB, DiscordCanary -ErrorAction SilentlyContinue | Measure-Object).Count)"
    Write-Host "Debug port   : $Port (reachable: $(Test-CdpUp))"
    Write-Host "Config       :"
    ($cfg.GetEnumerator() | ForEach-Object { "  $($_.Key) = $($_.Value)" }) | Write-Host
    $t = Find-DiscordTarget
    Write-Host "Renderer     : $(if ($t) { 'found' } else { 'not found' })"
    if ($t) {
        $expr = @"
JSON.stringify({
  agent: window.__questAgent ? window.__questAgent.version : null,
  status: window.__questAgent ? (window.__questAgent.error || window.__questAgent.status || 'ok') : null,
  hudButton: !!document.querySelector('#qb-btn'),
  activeTasks: window.__questAgent && window.__questAgent.state ? window.__questAgent.state.activeTasks : null,
  quests: window.__questAgent && window.__questAgent.ui ? window.__questAgent.ui.snapshot() : null
})
"@
        try {
            $r = Invoke-CdpEval -WsUrl $t.webSocketDebuggerUrl -Expression $expr -ReturnByValue $true
            $val = ($r | ConvertFrom-Json).result.result.value
            Write-Host "Agent state  : $val"
        } catch { Write-Host "Agent state  : eval failed - $($_.Exception.Message)" }
    }
}

if ($Diagnose) { Invoke-Diagnose; exit 0 }

# ---- Main -------------------------------------------------------------------
Write-Log "Discord Quest Agent v$(Get-LocalVersion) starting (port $Port)." "Cyan"

if (Invoke-SelfUpdate) {
    # Relaunch the freshly downloaded copy and hand over.
    $args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$(Join-Path $Root 'src\QuestAgent.ps1')`"", "-NoUpdate")
    if ($AttachOnly) { $args += "-AttachOnly" }
    if ($NoWatch) { $args += "-NoWatch" }
    Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -ArgumentList $args
    exit 0
}

$branchInfo = Resolve-Branch
Write-Log "Discord branch: $($branchInfo.Name)"

function Start-DiscordWithPort {
    # Never restart Discord out from under its own updater - that is how a
    # half-written app-<version> folder gets left on disk.
    if (Test-DiscordUpdating $branchInfo) {
        Write-Log "Discord is updating - leaving it alone, will retry shortly." "Yellow"
        return $false
    }
    $updater = Get-DiscordUpdateExe $branchInfo
    $exe = Get-DiscordExe $branchInfo
    if (-not $updater -and -not $exe) {
        Write-Log "No usable $($branchInfo.Proc).exe under $($branchInfo.Dir) - every build there is incomplete." "Red"
        return $false
    }
    Stop-Discord $branchInfo
    if ($updater) {
        # Squirrel's own launch path: it picks the active version itself, so a
        # staged or interrupted build can never be started by mistake.
        Start-Process -FilePath $updater -ArgumentList @(
            "--processStart", "$($branchInfo.Proc).exe",
            "--process-start-args", "--remote-debugging-port=$Port"
        )
        Write-Log "Relaunched Discord (via Update.exe) with the debugging port." "Yellow"
    } else {
        Start-Process -FilePath $exe -ArgumentList "--remote-debugging-port=$Port"
        Write-Log "Relaunched Discord with the debugging port." "Yellow"
    }
    return $true
}

if (-not (Test-CdpUp)) {
    $running = @(Get-Process -Name $branchInfo.Proc -ErrorAction SilentlyContinue)
    $mayLaunch = $true
    if ($AttachOnly) {
        Write-Log "Attach-only: waiting for a debuggable Discord..." "Cyan"
        $mayLaunch = $false
    } elseif ($running.Count -and -not $cfg.restartDiscord) {
        Write-Log "Discord is running without the debugging port and restartDiscord is false. Nothing to do." "Yellow"
        exit 0
    }
    $launched = $false
    if ($mayLaunch) { $launched = Start-DiscordWithPort }
    $deadline = (Get-Date).AddMinutes(10)
    $nextTry = (Get-Date).AddSeconds(30)
    while (-not (Test-CdpUp)) {
        if ((Get-Date) -gt $deadline) { Write-Log "Debug port never came up; giving up." "Yellow"; exit 0 }
        # A launch skipped because Discord was mid-update gets retried until the
        # updater finishes.
        if ($mayLaunch -and -not $launched -and (Get-Date) -gt $nextTry) {
            $launched = Start-DiscordWithPort
            $nextTry = (Get-Date).AddSeconds(30)
        }
        Start-Sleep -Seconds 3
    }
}

Write-Log "Waiting for Discord's renderer (log in if prompted)..." "Cyan"
$deadline = (Get-Date).AddMinutes(10)
$status = "notarget"
while ($status -eq "notarget") {
    $status = Invoke-Injection
    if ($status -eq "notarget") {
        if ((Get-Date) -gt $deadline) { Write-Log "No renderer with webpack found; giving up." "Yellow"; exit 0 }
        Start-Sleep -Seconds 3
    }
}
switch ($status) {
    "injected" { Write-Log "Agent injected. Look for the Auto Quests button in Discord's title bar." "Green" }
    "present"  { Write-Log "Agent already running in Discord." "Green" }
    "error"    { Write-Log "Injection failed - Discord's internals may have changed. Run with -Diagnose." "Yellow" }
}

if ($NoWatch) { exit 0 }

# ---- Watchdog ---------------------------------------------------------------
Write-Log "Watching: re-injects after reloads and Discord updates. Exits when Discord closes." "DarkCyan"
$missingSince = $null
while ($true) {
    Start-Sleep -Seconds 20
    # The uninstaller deletes the install folder; don't outlive it.
    if (-not (Test-Path $AgentJs)) { Write-Log "Install folder is gone (uninstalled) - exiting." "DarkGray"; break }
    if (Test-CdpUp) {
        $missingSince = $null
        try {
            $s = Invoke-Injection
            if ($s -eq "injected") { Write-Log "Re-injected after a reload." "Green" }
        } catch { }
        continue
    }
    # Port is gone: either Discord closed, or it updated and relaunched without the flag.
    $running = Get-Process -Name $branchInfo.Proc -ErrorAction SilentlyContinue
    if (-not $running) { Write-Log "Discord closed - exiting." "DarkGray"; break }
    if (-not $cfg.restartDiscord -or $AttachOnly) { continue }
    if ($null -eq $missingSince) { $missingSince = Get-Date; continue }
    if (((Get-Date) - $missingSince).TotalSeconds -ge 40) {
        if (Test-DiscordUpdating $branchInfo) {
            Write-Log "Discord is updating - waiting for it to finish before restarting it." "DarkGray"
        } else {
            Write-Log "Discord is running without the debugging port (likely auto-updated)." "Yellow"
            [void](Start-DiscordWithPort)
        }
        $missingSince = $null
    }
}
