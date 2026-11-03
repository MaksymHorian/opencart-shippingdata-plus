$ErrorActionPreference = 'Stop'
$docsSrc = Join-Path $PSScriptRoot '..\..\docs\ukrposhta'
$docsDst = Join-Path $PSScriptRoot '..\..\docs\rozetka_delivery'
if (Test-Path $docsDst) { Remove-Item $docsDst -Recurse -Force }
Copy-Item $docsSrc $docsDst -Recurse -Force
Get-ChildItem $docsDst -Recurse -File | ForEach-Object {
    $c = [System.IO.File]::ReadAllText($_.FullName, [System.Text.UTF8Encoding]::new($false))
    $n = $c -replace 'Ukrposhta API', 'ROZETKA Delivery'
    $n = $n -replace 'ukrposhta_cron', 'rozetka_delivery_cron'
    $n = $n -replace 'ukrposhta', 'rozetka_delivery'
    if ($n -ne $c) {
        [System.IO.File]::WriteAllText($_.FullName, $n, [System.Text.UTF8Encoding]::new($false))
    }
}
@(
    'instruction\content.en.html',
    'instruction\content.ru.html',
    'instruction\runtime.js',
    'instruction.html'
) | ForEach-Object {
    $p = Join-Path $docsDst $_
    if (Test-Path $p) { Remove-Item $p -Force }
}
Write-Host "Docs ready: $docsDst"
