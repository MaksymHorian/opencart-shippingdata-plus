# Playwright admin screenshots for customer instruction — real Chromium window (maximized).
param(
    [string]$Module = 'ukrposhta',
    [string]$Targets = '1',
    [string]$BaseUrl = 'http://oc3/admin'
)

$ErrorActionPreference = 'Stop'

foreach ($nodeDir in @('C:\Program Files\nodejs', 'C:\Program Files (x86)\nodejs')) {
    if ((Test-Path (Join-Path $nodeDir 'node.exe')) -and ($env:PATH -notlike "*$nodeDir*")) {
        $env:PATH = "$nodeDir;" + $env:PATH
    }
}

. (Join-Path (Split-Path $PSScriptRoot -Parent) 'lib\ReleaseModule.ps1')

$manifest = Import-ReleaseManifest -Module $Module
$screenshotPaths = Get-ModuleScreenshotPaths -Manifest $manifest
$scriptDir = Join-Path $PSScriptRoot 'image-screenshot'
$outDir = $screenshotPaths.OutputDir
$depsMarker = Join-Path $scriptDir '.deps-installed'

if (-not (Test-Path $scriptDir)) {
    Write-Error "Missing $scriptDir"
}

if (-not (Test-Path $screenshotPaths.SpecFile)) {
    Write-Error "Screenshot spec not found: $($screenshotPaths.SpecFile)"
}

New-Item -ItemType Directory -Path $outDir -Force | Out-Null

Push-Location $scriptDir
try {
    if (-not (Test-Path 'node_modules\playwright')) {
        Write-Host 'First run: installing npm package playwright...'
        npm install --no-fund --no-audit 2>&1 | Write-Host
    }

    $playwrightBrowsers = Join-Path $env:LOCALAPPDATA 'ms-playwright'
    $chromiumReady = (Test-Path $playwrightBrowsers) -and (
        Get-ChildItem $playwrightBrowsers -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like 'chromium-*' }
    )
    if (-not $chromiumReady) {
        Write-Host 'Installing Playwright Chromium...'
        npx playwright install chromium 2>&1 | Write-Host
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } else {
        Write-Host 'Playwright Chromium already on disk — skip install.'
    }
    New-Item -ItemType File -Path $depsMarker -Force | Out-Null

    node capture.mjs --module $Module --targets $Targets --base-url $BaseUrl --out-dir $outDir
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    $maxTarget = switch ($Module) {
        'ukrposhta' { 23 }
        'novaposhta' { 23 }
        'meest' { 24 }
        default { 16 }
    }
    $ids = if ($Targets -eq 'all') { 1..$maxTarget } else {
        foreach ($raw in ($Targets -split ',')) {
            $t = $raw.Trim()
            if (-not $t) { continue }
            if ($t -match '^(\d+)-(\d+)$') {
                [int]$Matches[1]..[int]$Matches[2]
            } elseif ($t -match '^\d+$') {
                [int]$t
            } else {
                $t
            }
        }
    }

    Add-Type -AssemblyName System.Drawing
    foreach ($id in $ids) {
        $pngName = if ($id -is [int] -or "$id" -match '^\d+$') { "screenshot_$id.png" } else { "$id.png" }
        $png = Join-Path $outDir $pngName
        if (-not (Test-Path $png)) { Write-Error "Missing $png" }
        $img = [System.Drawing.Image]::FromFile($png)
        try {
            Write-Host "validated $pngName $($img.Width)x$($img.Height) -> $png"
            if ($img.Width -lt 1200) { Write-Warning 'Width below 1200 - may be cropped' }
        } finally { $img.Dispose() }
    }
} finally {
    Pop-Location
}
