# Tests the launcher's addon loading (Get-AddonFiles / Invoke-AddonInjection in
# src\QuestAgent.ps1) without Discord: the two functions are lifted out of the
# script with the PowerShell parser and run against a fake Invoke-CdpEval.
# Run: powershell -NoProfile -File dev\test-addons.ps1   (5.1 or 7). Exit code 1 on failure.
$ErrorActionPreference = "Stop"
$script = Join-Path (Split-Path -Parent $PSScriptRoot) "src\QuestAgent.ps1"
$ast = [System.Management.Automation.Language.Parser]::ParseFile($script, [ref]$null, [ref]$null)
foreach ($name in @("Get-AddonFiles", "Invoke-AddonInjection")) {
    $fn = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name }, $true)
    if (-not $fn) { throw "function $name not found in QuestAgent.ps1" }
    . ([scriptblock]::Create($fn.Extent.Text))
}

$fails = 0
function Check([string]$what, [bool]$ok) {
    if ($ok) { Write-Host "ok   $what" } else { Write-Host "FAIL $what" -ForegroundColor Red; $script:fails++ }
}

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("qa-addons-" + [guid]::NewGuid().ToString("N"))
$shipped = Join-Path $tmp "src\addons"; $user = Join-Path $tmp "addons"
New-Item -ItemType Directory -Force -Path $shipped, $user | Out-Null
try {
    Set-Content -LiteralPath (Join-Path $shipped "pet.js") -Value "shipped-pet" -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $shipped "zeta.js") -Value "shipped-zeta" -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $user "PET.js") -Value "user-pet" -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $user "arpg.js") -Value "var s = '$([char]0x00e9)';" -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $user "notes.txt") -Value "ignored" -Encoding ASCII

    $files = @(Get-AddonFiles -ShippedDir $shipped -UserDir $user)
    Check "three addons found (txt ignored, same name deduplicated)" ($files.Count -eq 3)
    Check "sorted by name" ((($files | ForEach-Object Name) -join ",") -eq "arpg.js,PET.js,zeta.js")
    Check "the user's file wins over a shipped one with the same name" (($files | Where-Object { $_.Name -ieq "pet.js" }).DirectoryName -eq $user)
    Check "a missing user folder is fine" (@(Get-AddonFiles -ShippedDir $shipped -UserDir (Join-Path $tmp "nope")).Count -eq 2)

    # Injection: every file is evaluated, in order, as pure ASCII; one failure doesn't stop the rest.
    $script:sent = @()
    function Invoke-CdpEval { param([string]$WsUrl, [string]$Expression) $script:sent += $Expression; if ($Expression -match "shipped-zeta") { throw "boom" }; return '{"id":1,"result":{}}' }
    $script:logs = @()
    function Write-Log { param([string]$Message, [string]$Color) $script:logs += $Message }
    function Get-AddonFiles { param() Get-ChildItem -LiteralPath $user, $shipped -Filter *.js -File | Where-Object { $_.Name -ne "pet.js" -or $_.DirectoryName -eq $user } | Sort-Object Name }
    Invoke-AddonInjection -WsUrl "ws://fake"
    Check "all three evaluated" ($script:sent.Count -eq 3)
    Check "non-ASCII escaped" ($script:sent[0].Contains('\u00e9') -and ($script:sent -join "") -notmatch '[^\x00-\x7F]')
    Check "a throwing addon is logged, not fatal" (($script:logs -join "`n") -match "zeta.js could not be injected")
} finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
if ($fails) { Write-Host "$fails failed" -ForegroundColor Red; exit 1 }
Write-Host "all passed"
