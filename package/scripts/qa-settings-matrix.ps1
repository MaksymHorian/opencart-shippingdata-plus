# Run OC Max QA suites (cart / cn-form / cn-list).
# Usage: .\qa-settings-matrix.ps1 -Module meest [-Suite all|cart|cn-form|cn-list] [-Layer all]

param(
    [Parameter(Mandatory = $true)]
    [string]$Module,
    [ValidateSet('all', 'cart', 'cn-form', 'cn-list')]
    [string]$Suite = 'all',
    [ValidateSet('all', 'catalog_quote', 'catalog_soft', 'documented')]
    [string]$Layer = 'all',
    [string]$StoreRoot = '',
    [string]$PhpExe = ''
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not $StoreRoot) {
    $StoreRoot = $repoRoot
}

if (-not $PhpExe) {
    $candidates = @(
        'C:\OpenServer\modules\PHP-8.1\php.exe',
        'C:\OpenServer\modules\PHP-8.2\php.exe',
        'C:\OpenServer\modules\PHP-8.0\php.exe',
        'C:\OpenServer\modules\PHP-7.4\php.exe'
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

$script = Join-Path $repoRoot 'package\qa\run-qa-suite.php'
if (-not (Test-Path $script)) {
    throw "Missing $script"
}

& $PhpExe $script "--module=$Module" "--suite=$Suite" "--layer=$Layer" "--store=$StoreRoot"
exit $LASTEXITCODE
