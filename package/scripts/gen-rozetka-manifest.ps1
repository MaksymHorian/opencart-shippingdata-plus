$ErrorActionPreference = 'Stop'
$srcPath = Join-Path $PSScriptRoot '..\modules\ukrposhta\manifest.json'
$outDir = Join-Path $PSScriptRoot '..\modules\rozetka_delivery'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$src = Get-Content $srcPath -Raw -Encoding UTF8
$m = $src
$m = $m -replace 'ukrposhta_cron', 'rozetka_delivery_cron'
$m = $m -replace 'ukrposhta', 'rozetka_delivery'
$m = $m -replace 'Ukrposhta API', 'ROZETKA Delivery'
$m = $m -replace 'opencart-rozetka_delivery', 'opencart-rozetka-delivery'
$m = $m -replace '"versionDefault": "v. 2.3.1"', '"versionDefault": "v. 1.2.0"'
$m = $m -replace '(?m)^\s*"seedFromVersion": "v\. 2\.3\.0",\r?\n', ''
$m = $m -replace 'name=\\"shipping_rozetka_delivery\[', 'name=\"rozetka_delivery['
$m = $m -replace 'name=\\"shipping_rozetka_delivery_status\\"', 'name=\"rozetka_delivery_status\"'
$m = $m -replace 'name=\\"shipping_rozetka_delivery_sort_order\\"', 'name=\"rozetka_delivery_sort_order\"'
$m = $m -replace 'modules\\ukrposhta\\tpl-snippets', 'modules\\rozetka_delivery\\tpl-snippets'
$m = $m -replace 'rozetka_delivery_api_\{version\}', 'rozetka_delivery_{version}'

$outPath = Join-Path $outDir 'manifest.json'
[System.IO.File]::WriteAllText($outPath, $m, [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $outPath"
