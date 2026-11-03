# ZIP version: -ZipVersion (never -Version — powershell.exe steals it).
# Persistent Chrome profile: package/scripts/marketplace-upload/.profile-chrome (gitignored).
# Gallery: screenshot_* only (no logo). Thumbs: logo_opencartcode_1 / _2, else logo.png.
param(
    [Parameter(Mandatory = $true)]
    [string]$EditUrl,
    [string]$Zip = '',
    [string]$Square = '',
    [string]$Thumb = '',
    [string]$GalleryDir = '',
    [int]$MaxGallery = 30,
    [string]$FeaturesJson = '',
    [string]$DescriptionUk = '',
    [string]$DescriptionEn = '',
    [string]$Price = '',
    [string]$OriginalPrice = '',
    [string]$Extras = '',
    [switch]$DumpPrices,
    [switch]$DumpForm,
    [switch]$UncheckDomainLater,
    [string]$Slug = '',
    [string]$ExtraCategories = '',
    [string]$ZipVersion = '',
    [string]$ChangelogUk = '',
    [string]$ChangelogEn = '',
    [string]$ChangelogUkFile = '',
    [string]$ChangelogEnFile = '',
    [switch]$DumpProducts,
    [switch]$ForceZip,
    [switch]$SkipZip
)

$ErrorActionPreference = 'Stop'

foreach ($nodeDir in @('C:\Program Files\nodejs', 'C:\Program Files (x86)\nodejs')) {
    if ((Test-Path (Join-Path $nodeDir 'node.exe')) -and ($env:PATH -notlike "*$nodeDir*")) {
        $env:PATH = "$nodeDir;" + $env:PATH
    }
}

$scriptDir = Join-Path $PSScriptRoot 'marketplace-upload'
$shotDir = Join-Path $PSScriptRoot 'image-screenshot'
$uploadJs = Join-Path $scriptDir 'upload.mjs'

if (-not (Test-Path $uploadJs)) {
    throw "Missing $uploadJs"
}
if (-not (Test-Path (Join-Path $shotDir 'node_modules\playwright'))) {
    throw "Playwright not installed. Run capture-image-screenshots.ps1 once or npm install in $shotDir"
}

$argsList = @(
    $uploadJs,
    '--edit-url', $EditUrl
)
if ($Zip) { $argsList += @('--zip', $Zip) }
if ($SkipZip) { $argsList += '--skip-zip' }
if ($Square) { $argsList += @('--square', $Square) }
if ($Thumb) { $argsList += @('--thumb', $Thumb) }
if ($GalleryDir) { $argsList += @('--gallery-dir', $GalleryDir, '--max-gallery', "$MaxGallery") }
if ($FeaturesJson) { $argsList += @('--features-json', $FeaturesJson) }
if ($DescriptionUk) { $argsList += @('--description-uk', $DescriptionUk) }
if ($DescriptionEn) { $argsList += @('--description-en', $DescriptionEn) }
if ($Price) { $argsList += @('--price', $Price) }
if ($OriginalPrice) { $argsList += @('--original-price', $OriginalPrice) }
if ($Extras) { $argsList += @('--extras', $Extras) }
if ($DumpPrices) { $argsList += '--dump-prices' }
if ($DumpForm) { $argsList += '--dump-form' }
if ($UncheckDomainLater) { $argsList += '--uncheck-domain-later' }
if ($Slug) { $argsList += @('--slug', $Slug) }
if ($ExtraCategories) { $argsList += @('--extra-categories', $ExtraCategories) }
if ($ChangelogUkFile) { $ChangelogUk = (Get-Content -LiteralPath $ChangelogUkFile -Raw -Encoding UTF8).Trim() }
if ($ChangelogEnFile) { $ChangelogEn = (Get-Content -LiteralPath $ChangelogEnFile -Raw -Encoding UTF8).Trim() }
if ($ZipVersion) { $argsList += @('--version', $ZipVersion) }
if ($ChangelogUk) { $argsList += @('--changelog-uk', $ChangelogUk) }
if ($ChangelogEn) { $argsList += @('--changelog-en', $ChangelogEn) }
if ($DumpProducts) { $argsList += '--dump-products' }
if ($ForceZip) { $argsList += '--force-zip' }

& node @argsList
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
