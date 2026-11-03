# Build single multilingual instruction.html from language fragments.
# Usage: .\build-instruction.ps1 [-Module ukrposhta] [-Version "2.3.1"]

param(
    [string]$Module = 'ukrposhta',
    [string]$Version
)

$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path $PSScriptRoot -Parent
. (Join-Path $packageRoot 'lib\ReleaseModule.ps1')

$manifest = Import-ReleaseManifest -Module $Module
$paths = Get-ReleasePaths -Manifest $manifest
$instructionDir = Join-Path $paths.DocsSource 'instruction'

if (-not (Test-Path $instructionDir)) {
    throw "Instruction source dir not found: $instructionDir"
}

function Get-InstructionVersionFromFragments {
    param([string]$InstructionDir)
    $ukPath = Join-Path $InstructionDir 'content.uk.html'
    if (-not (Test-Path $ukPath)) {
        throw "Missing fragment: $ukPath"
    }
    $html = [System.IO.File]::ReadAllText($ukPath, [System.Text.UTF8Encoding]::new($false))
    if ($html -match '(?s)id="changelog".*?<kbd>v\.\s*([\d.]+)') {
        return $Matches[1].Trim()
    }
    if ($html -match '(?s)(<a class="navbar-brand"[^>]*>.*?)v\.\s*([\d.]+)') {
        return $Matches[2].Trim()
    }
    throw "Cannot parse instruction version from $ukPath (changelog or navbar)"
}

if (-not $Version) {
    $Version = Get-InstructionVersionFromFragments -InstructionDir $instructionDir
}
if ($Version -match '^\s*v\.\s*(.+)') {
    $semver = 'v. ' + $Matches[1].Trim()
} else {
    $semver = 'v. ' + $Version.Trim()
}
$langFiles = @{
    uk = Join-Path $instructionDir 'content.uk.html'
    en = Join-Path $instructionDir 'content.en.html'
    ru = Join-Path $instructionDir 'content.ru.html'
}

foreach ($key in $langFiles.Keys) {
    if (-not (Test-Path $langFiles[$key])) {
        throw "Missing fragment: $($langFiles[$key])"
    }
}

function Update-NavbarVersion {
    param([string]$Html, [string]$Semver)
    return [regex]::Replace(
        $Html,
        '(?s)(<a class="navbar-brand"[^>]*>.*?)v\. \d+\.\d+\.\d+',
        { param($m) $m.Groups[1].Value + $Semver },
        1
    )
}

function Get-InstructionLangMetaFromRuntime {
    param(
        [string]$RuntimeJs,
        [string]$Lang = 'uk'
    )
    $langPattern = [regex]::Escape($Lang)
    $pattern = "(?s)${langPattern}:\s*\{\s*htmlLang:\s*'[^']*',\s*title:\s*'([^']*)',\s*description:\s*'([^']*)'"
    if ($RuntimeJs -match $pattern) {
        return [PSCustomObject]@{
            Title       = $Matches[1]
            Description = $Matches[2]
        }
    }
    throw "Cannot parse LANG_META.$Lang from runtime.js"
}

$panels = @()
$order = @('uk', 'en', 'ru')
foreach ($code in $order) {
    $body = [System.IO.File]::ReadAllText($langFiles[$code], [System.Text.UTF8Encoding]::new($false))
    $body = Update-NavbarVersion -Html $body -Semver $semver
    $hidden = if ($code -eq 'uk') { '' } else { ' d-none' }
    $panels += @"
    <div id="lang-$code" class="lang-panel$hidden" data-lang="$code">
        <div class="container-fluid">
$body
        </div>
    </div>
"@
}

$panelsHtml = $panels -join "`n"
$runtimeJs = [System.IO.File]::ReadAllText((Join-Path $instructionDir 'runtime.js'), [System.Text.UTF8Encoding]::new($false))
$ukMeta = Get-InstructionLangMetaFromRuntime -RuntimeJs $runtimeJs -Lang 'uk'
$author = 'Prorab337'
$faviconUrl = "https://oc-max.com/docs/$Module/images/favicon.ico"
if ($manifest.PSObject.Properties.Name -contains 'instruction') {
    if ($manifest.instruction.author) { $author = $manifest.instruction.author }
    if ($manifest.instruction.faviconUrl) { $faviconUrl = $manifest.instruction.faviconUrl }
}

$shell = @"
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="utf-8">
    <title>$($ukMeta.Title)</title>
    <meta content="width=device-width, initial-scale=1.0" name="viewport">
    <meta content="$($ukMeta.Description)" name="description">
    <meta content="$author" name="author">
    <link id="favicon" href="$faviconUrl" rel="shortcut icon" type="image/x-icon"/>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
    <script src="https://code.jquery.com/jquery-3.7.1.min.js" integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/mark.js/8.11.0/jquery.mark.min.js" integrity="sha256-1iYR6/Bs+CrdUVeCpCmb4JcYVWvvCUEgpSU7HS5xhsY=" crossorigin="anonymous"></script>
    <script defer src="https://use.fontawesome.com/releases/v5.15.4/js/all.js"></script>
</head>
<body style="padding-top:70px">
$panelsHtml
<script type="text/javascript"><!--
$runtimeJs
//--></script>
</body>
</html>
"@

$outDocs = Join-Path $paths.DocsSource 'instruction.html'
[System.IO.File]::WriteAllText($outDocs, $shell, [System.Text.UTF8Encoding]::new($false))
Write-Host "Built: $outDocs ($($shell.Length) bytes, version $semver)"

return [PSCustomObject]@{
    Output  = $outDocs
    Version = $semver
    Bytes   = $shell.Length
}
