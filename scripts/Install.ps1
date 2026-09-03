<#
.SYNOPSIS
    Installs Discord Quest Agent into %LOCALAPPDATA%\DiscordQuestAgent.

.DESCRIPTION
    Copies the tool out of the extracted folder, writes config.json (with a
    per-machine random debug port), and optionally adds a startup shortcut so the
    agent runs on login. No admin rights required; nothing is written outside
    your user profile.

.NOTES
    Keep this file pure ASCII - PowerShell 5.1 reads BOM-less scripts as ANSI.
#>
param(
    [switch]$NoStartup,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$SourceRoot = Split-Path -Parent $PSScriptRoot
$InstallDir = Join-Path $env:LOCALAPPDATA "DiscordQuestAgent"
$StartupDir = [Environment]::GetFolderPath("Startup")
$StartMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "Discord Quest Agent"

function Say { param([string]$m, [string]$c = "Gray") if (-not $Quiet) { Write-Host $m -ForegroundColor $c } }

Say ""
Say "  Discord Quest Agent - installer" "Cyan"
Say "  --------------------------------" "Cyan"
Say ""

if ($SourceRoot -eq $InstallDir) { throw "Run this from the extracted download, not from the install folder." }
if (-not (Test-Path (Join-Path $SourceRoot "src\quest-agent.js"))) {
    throw "src\quest-agent.js is missing - extract the whole ZIP before running the installer."
}

# ---- Copy ------------------------------------------------------------------
Say "Installing to $InstallDir ..."
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
foreach ($item in @("src", "scripts", "VERSION", "README.md", "LICENSE", "Start-QuestAgent.bat", "Uninstall.bat")) {
    $from = Join-Path $SourceRoot $item
    if (Test-Path $from) { Copy-Item -Path $from -Destination $InstallDir -Recurse -Force }
}

# ---- Config (preserved across reinstalls) -----------------------------------
$configPath = Join-Path $InstallDir "config.json"
if (Test-Path $configPath) {
    Say "Keeping your existing config.json." "DarkGray"
} else {
    # A per-machine port is better than a well-known one: while Discord runs with
    # a debugging port open, any local process can drive that Discord session.
    $port = Get-Random -Minimum 9200 -Maximum 9899
    $cfg = [ordered]@{
        repo            = "BixiSG/discord-quest-agent"
        autoUpdate      = $true
        port            = $port
        branch          = "Auto"
        restartDiscord  = $true
        autoEnroll      = $true
        scanIntervalMs  = 120000
        maxTaskAttempts = 3
        hud             = $true
        notify          = $true
    }
    $cfg | ConvertTo-Json -Depth 4 | Set-Content -Path $configPath -Encoding UTF8
    Say "Wrote config.json (debug port $port)."
}

# ---- Shortcuts --------------------------------------------------------------
function New-Shortcut {
    param([string]$Path, [string]$Target, [string]$Arguments, [string]$Description, [switch]$Visible)
    $shell = New-Object -ComObject WScript.Shell
    $sc = $shell.CreateShortcut($Path)
    $sc.TargetPath = $Target
    $sc.Arguments = $Arguments
    $sc.WorkingDirectory = $InstallDir
    $sc.Description = $Description
    $sc.WindowStyle = $(if ($Visible) { 1 } else { 7 })   # 7 = minimised
    $sc.Save()
}

$psArgs = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}\src\QuestAgent.ps1"' -f $InstallDir

New-Item -ItemType Directory -Force -Path $StartMenu | Out-Null
New-Shortcut -Path (Join-Path $StartMenu "Discord Quest Agent.lnk") `
    -Target "powershell.exe" -Arguments $psArgs -Description "Start the Discord Quest Agent"
New-Shortcut -Path (Join-Path $StartMenu "Quest Agent Diagnostics.lnk") `
    -Target "powershell.exe" `
    -Arguments ('-NoProfile -ExecutionPolicy Bypass -NoExit -File "{0}\src\QuestAgent.ps1" -Diagnose' -f $InstallDir) `
    -Description "Print a support report"
New-Shortcut -Path (Join-Path $StartMenu "Uninstall Quest Agent.lnk") `
    -Target (Join-Path $InstallDir "Uninstall.bat") -Arguments "" -Description "Remove Discord Quest Agent" -Visible
Say "Added Start Menu shortcuts."

$startupLnk = Join-Path $StartupDir "Discord Quest Agent.lnk"
if ($NoStartup) {
    Remove-Item -Path $startupLnk -Force -ErrorAction SilentlyContinue
    Say "Startup entry not installed (-NoStartup)." "DarkGray"
} else {
    New-Shortcut -Path $startupLnk -Target "powershell.exe" -Arguments $psArgs -Description "Discord Quest Agent"
    Say "Runs automatically at login."
}

Say ""
Say "  Installed." "Green"
Say ""
Say "  IMPORTANT: Discord must be started by this tool so it exposes a" "Yellow"
Say "  localhost debugging port. It will restart Discord once now." "Yellow"
Say ""
Say "  Start it from the Start Menu ('Discord Quest Agent') or let it run" "Gray"
Say "  at your next login. Look for the Auto Quests button in Discord's" "Gray"
Say "  title bar, next to the Inbox icon." "Gray"
Say ""
Say "  Uninstall any time with Uninstall.bat in $InstallDir" "DarkGray"
Say ""
