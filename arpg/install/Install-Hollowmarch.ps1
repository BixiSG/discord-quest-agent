<#
.SYNOPSIS
    Installs Hollowmarch, the idle ARPG addon, into Discord Quest Agent.

.DESCRIPTION
    Copies arpg.js into %LOCALAPPDATA%\DiscordQuestAgent\addons\, where the
    launcher picks up user-installed addons (they survive agent updates). Then
    switch it on in the Quest Agent panel: Settings > Addons > Hollowmarch.
    Saves live inside Discord (IndexedDB) and are not touched by this script.

.PARAMETER Uninstall
    Removes the addon file again. The hero stays in Discord's storage.

.PARAMETER InstallRoot
    Quest Agent's install folder. Defaults to %LOCALAPPDATA%\DiscordQuestAgent.

.NOTES
    Keep this file pure ASCII - PowerShell 5.1 reads BOM-less scripts as ANSI.
#>
param(
    [switch]$Uninstall,
    [string]$InstallRoot = $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "DiscordQuestAgent" } else { "" }),
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
function Say { param([string]$m, [string]$c = "Gray") if (-not $Quiet) { Write-Host $m -ForegroundColor $c } }

if (-not $InstallRoot) { throw "No install folder: pass -InstallRoot." }
$addonDir = Join-Path $InstallRoot "addons"
$target = Join-Path $addonDir "arpg.js"

if ($Uninstall) {
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force; Say "Hollowmarch removed from $addonDir." "Green" }
    else { Say "Hollowmarch is not installed in $addonDir." }
    Say "Your hero stays in Discord's storage; reinstalling brings it back."
    exit 0
}

$source = Join-Path (Split-Path -Parent $PSScriptRoot) "dist\arpg.js"
if (-not (Test-Path -LiteralPath $source)) { throw "arpg.js not found at $source. Build it first: cd arpg; npm install; npm run build" }
$bytes = [IO.File]::ReadAllBytes($source)
foreach ($b in $bytes) { if ($b -gt 0x7E -or ($b -lt 0x20 -and $b -ne 0x0A -and $b -ne 0x0D -and $b -ne 0x09)) { throw "arpg.js is not pure ASCII; rebuild it with npm run build." } }
if (-not ([Text.Encoding]::ASCII.GetString($bytes, 0, [Math]::Min(200, $bytes.Length)) -match "Hollowmarch")) { throw "$source does not look like the Hollowmarch build." }

if (-not (Test-Path -LiteralPath (Join-Path $InstallRoot "VERSION"))) {
    Say "Discord Quest Agent does not seem to be installed in $InstallRoot." "Yellow"
    Say "Install it first (Install.bat), then run this again." "Yellow"
    exit 1
}
$launcher = Join-Path $InstallRoot "src\QuestAgent.ps1"
if ((Test-Path -LiteralPath $launcher) -and -not (Select-String -LiteralPath $launcher -Pattern "Get-AddonFiles" -SimpleMatch -Quiet)) {
    Say "This Quest Agent launcher does not load addons from $addonDir yet." "Yellow"
    Say "The file is installed anyway and will load once the agent is updated to a version with user addons." "Yellow"
}

New-Item -ItemType Directory -Force -Path $addonDir | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force
Say "Hollowmarch installed: $target" "Green"
Say "Restart the agent (or Discord), then open the Quest Agent panel: Settings > Addons > Hollowmarch."
