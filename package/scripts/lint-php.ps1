# PHP lint: PHPStan + PHP-CS-Fixer (variant B — always both).
# Usage:
#   .\package\scripts\lint-php.ps1
#   .\package\scripts\lint-php.ps1 -Module meest
#   .\package\scripts\lint-php.ps1 -Module meest -Fix   # apply CS-Fixer (not PHPStan)

param(
    [string]$Module = '',
    [switch]$Fix,
    [string]$RepoRoot = '',
    [string]$PhpExe = '',
    [string]$Php72Exe = ''
)

$ErrorActionPreference = 'Stop'

if (-not $RepoRoot) {
    $RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}

. (Join-Path (Split-Path $PSScriptRoot -Parent) 'lib\LintPaths.ps1')

if (-not $PhpExe) {
    # PHP 8.1.34 (OpenServer x64 build) segfaults with 0xC0000409 while parsing some
    # uk-ua language files that 8.0 and 8.3 accept, so it is only a last resort here.
    $candidates = @(
        'C:\OpenServer\modules\PHP-8.3\php.exe',
        'C:\OpenServer\modules\PHP-8.2\php.exe',
        'C:\OpenServer\modules\PHP-8.0\php.exe',
        'C:\OpenServer\modules\PHP-8.1\php.exe'
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) {
            $PhpExe = $c
            break
        }
    }
}

if (-not $PhpExe -or -not (Test-Path $PhpExe)) {
    throw 'php.exe not found. Pass -PhpExe path.'
}

if (-not $Php72Exe) {
    # Syntax floor for module code: arrow functions, typed properties, ??= and
    # array spread are all PHP 7.4+, so `php -l` under 7.2 rejects every one of them.
    $Php72Exe = 'C:\OpenServer\modules\PHP-7.2\php.exe'
}
if (-not (Test-Path $Php72Exe)) {
    throw 'PHP 7.2 php.exe not found (syntax-floor gate). Pass -Php72Exe path.'
}

$packageDir = Join-Path $RepoRoot 'package'
# Prefer package/vendor PHPStan (has unused-public). Fallback: OpenCart vendor.
$phpstan = Join-Path $packageDir 'vendor\bin\phpstan'
if (-not (Test-Path $phpstan)) {
    $phpstan = Join-Path $packageDir 'vendor\bin\phpstan.bat'
}
if (-not (Test-Path $phpstan)) {
    $phpstan = Join-Path $RepoRoot 'system\storage\vendor\bin\phpstan'
}
if (-not (Test-Path $phpstan)) {
    $phpstan = Join-Path $RepoRoot 'system\storage\vendor\bin\phpstan.bat'
}
if (-not (Test-Path $phpstan)) {
    throw "PHPStan not found. Run: composer install in package/ (or use system/storage/vendor)."
}
$unusedPublicNeon = Join-Path $packageDir 'vendor\tomasvotruba\unused-public\config\extension.neon'
if (-not (Test-Path $unusedPublicNeon)) {
    throw "tomasvotruba/unused-public missing. Run: composer install in package/"
}

$csFixer = Join-Path $packageDir 'bin\php-cs-fixer.phar'
if (-not (Test-Path $csFixer)) {
    $csFixer = Join-Path $packageDir 'vendor\bin\php-cs-fixer'
    if (-not (Test-Path $csFixer)) {
        $csFixerBat = Join-Path $packageDir 'vendor\bin\php-cs-fixer.bat'
        if (Test-Path $csFixerBat) { $csFixer = $csFixerBat }
    }
}

if (-not (Test-Path $csFixer)) {
    throw 'PHP-CS-Fixer not found. Expected package\bin\php-cs-fixer.phar or run composer install in package/.'
}

$paths = Get-OcmaxLintPaths -RepoRoot $RepoRoot -Module $Module
if (-not $paths -or $paths.Count -eq 0) {
    throw 'No PHP files to lint for the given scope.'
}

$phpFiles = $paths | Where-Object { $_.ToLower().EndsWith('.php') }
if (-not $phpFiles -or $phpFiles.Count -eq 0) {
    throw 'No .php files in lint scope.'
}

$report = @{
    ok = $true
    module = $Module
    php72_syntax = @{ ok = $true; output = '' }
    phpstan = @{ ok = $true; output = '' }
    cs_fixer = @{ ok = $true; output = '' }
    files = @($phpFiles.Count)
}

Write-Host "Lint: PHP 7.2 syntax + PHPStan + PHP-CS-Fixer ($($phpFiles.Count) files)" -ForegroundColor Cyan

# CS-Fixer config split, also reused by the 7.2 syntax gate below.
$packagePhp = $phpFiles | Where-Object { $_.Replace('\', '/').ToLower().Contains('/package/') }
$modulePhp = $phpFiles | Where-Object { -not $_.Replace('\', '/').ToLower().Contains('/package/') }

# PHP 7.2 syntax floor (module files only; package tooling may target newer PHP).
# -n skips php.ini: the OpenServer 7.2 CLI ini needs the running server for opcache.
$syntaxFailures = @()
$prevPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
foreach ($file in $modulePhp) {
    $lintOut = & $Php72Exe -n -l $file 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        $syntaxFailures += $lintOut.Trim()
    }
}
$ErrorActionPreference = $prevPreference
$report.php72_syntax.output = ($syntaxFailures -join "`n").Trim()
if ($syntaxFailures.Count -gt 0) {
    $report.ok = $false
    $report.php72_syntax.ok = $false
    Write-Host "PHP 7.2 syntax check failed:" -ForegroundColor Red
    Write-Host $report.php72_syntax.output
}

# PHPStan
$stanArgs = @('analyse', '-c', (Join-Path $packageDir 'phpstan.neon'), '--no-progress') + $phpFiles
$prevPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$stanOut = & $PhpExe $phpstan @stanArgs 2>&1 | Out-String
$stanCode = $LASTEXITCODE
$ErrorActionPreference = $prevPreference
$report.phpstan.output = $stanOut.Trim()
if ($stanCode -ne 0) {
    $report.ok = $false
    $report.phpstan.ok = $false
    Write-Host $stanOut
}

# PHP-CS-Fixer (dry-run unless -Fix)
function Invoke-CsFixerCheck {
    param($PhpExe, $CsFixer, $Config, $Files, $Fix)
    if (-not $Files -or $Files.Count -eq 0) { return @{ ok = $true; output = '' } }
    $args = @('fix', '--config', $Config, '--using-cache=no', '--format=txt')
    if (-not $Fix) { $args += '--dry-run'; $args += '--diff' }
    $args += $Files
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = & $PhpExe $CsFixer @args 2>&1 | Out-String
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    return @{ ok = ($code -eq 0); output = $out.Trim() }
}

$fixerResults = @()
if ($packagePhp.Count -gt 0) {
    $fixerResults += Invoke-CsFixerCheck -PhpExe $PhpExe -CsFixer $csFixer -Config (Join-Path $packageDir '.php-cs-fixer.dist.php') -Files $packagePhp -Fix:$Fix
}
if ($modulePhp.Count -gt 0) {
    $fixerResults += Invoke-CsFixerCheck -PhpExe $PhpExe -CsFixer $csFixer -Config (Join-Path $packageDir 'php-cs-fixer.extension.php') -Files $modulePhp -Fix:$Fix
}

$fixerOut = ($fixerResults | ForEach-Object { $_.output }) -join "`n`n"
$report.cs_fixer.output = $fixerOut.Trim()
if ($fixerResults | Where-Object { -not $_.ok }) {
    $report.ok = $false
    $report.cs_fixer.ok = $false
    Write-Host $fixerOut
}

$reportDir = Join-Path $packageDir 'qa\reports'
if (-not (Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}
$summaryPath = Join-Path $reportDir ('lint-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
$report | ConvertTo-Json -Depth 5 | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host ""
if ($report.ok) {
    Write-Host "Lint PASS - report: $summaryPath" -ForegroundColor Green
    exit 0
}

Write-Host "Lint FAIL - report: $summaryPath" -ForegroundColor Red
if (-not $Fix -and -not $report.cs_fixer.ok) {
    Write-Host "Tip: .\package\scripts\lint-php.ps1 -Module $Module -Fix  (CS-Fixer only)" -ForegroundColor Yellow
}
exit 1
