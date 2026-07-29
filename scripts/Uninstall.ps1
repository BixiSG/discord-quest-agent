<#
.SYNOPSIS
    Removes Discord Quest Agent: shortcuts, install folder, running processes.

.NOTES
    Keep this file pure ASCII - PowerShell 5.1 reads BOM-less scripts as ANSI.
#>
param([switch]$KeepConfig, [switch]$Quiet)

$ErrorActionPreference = "Continue"
$InstallDir = Join-Path $env:LOCALAPPDATA "DiscordQuestAgent"
$StartupLnk = Join-Path ([Environment]::GetFolderPath("Startup")) "Discord Quest Agent.lnk"
$StartMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "Discord Quest Agent"

function Say { param([string]$m, [string]$c = "Gray") if (-not $Quiet) { Write-Host $m -ForegroundColor $c } }

Say ""
Say "  Discord Quest Agent - uninstaller" "Cyan"
Say ""

# Stop any resident agent watchers.
$killed = 0
Get-CimInstance Win32_Process -Filter "Name like '%powershell%'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'QuestAgent\.ps1' -and $_.ProcessId -ne $PID } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $killed++ }
Say "Stopped $killed running agent process(es)."

Remove-Item -Path $StartupLnk -Force -ErrorAction SilentlyContinue
Remove-Item -Path $StartMenu -Recurse -Force -ErrorAction SilentlyContinue
Say "Removed shortcuts."

if ($KeepConfig -and (Test-Path (Join-Path $InstallDir "config.json"))) {
    Get-ChildItem -Path $InstallDir -Exclude "config.json" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Say "Removed program files (config.json kept)."
} else {
    # The uninstaller may be running from inside the folder it is deleting, so
    # hand the final delete to a detached shell.
    Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -ArgumentList @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
        "Start-Sleep -Seconds 2; Remove-Item -LiteralPath '$InstallDir' -Recurse -Force -ErrorAction SilentlyContinue"
    )
    Say "Removing $InstallDir ..."
}

Say ""
Say "  Done. Discord itself was not modified." "Green"
Say "  It will keep launching with a debugging port until you restart it" "DarkGray"
Say "  normally (from its own shortcut)." "DarkGray"
Say ""
