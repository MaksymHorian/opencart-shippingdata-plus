# One-time extract language bodies from legacy 3-file instruction HTML.
param(
    [string]$SourceDir = 'c:\OpenServer\home\OCMax\Ukrposhta API\v. 2.3.1\original',
    [string]$OutDir = 'c:\OpenServer\home\oc3\docs\ukrposhta\instruction'
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

$map = [ordered]@{
    uk = 'instruction.html'
    en = 'instruction_en.html'
    ru = 'instruction_ru.html'
}

foreach ($lang in $map.Keys) {
    $path = Join-Path $SourceDir $map[$lang]
    $raw = Get-Content $path -Raw -Encoding UTF8
    if ($raw -notmatch '(?s)<div class="container-fluid">\s*(.*?)\s*<script type="text/javascript">') {
        throw "Cannot parse container body: $path"
    }
    $content = $Matches[1]
    $content = $content.Replace(
        '<a class="dropdown-item" href="instruction.html">',
        '<a class="dropdown-item lang-switch" href="#" data-lang="uk">'
    )
    $content = $content.Replace(
        '<a class="dropdown-item" href="instruction_en.html">',
        '<a class="dropdown-item lang-switch" href="#" data-lang="en">'
    )
    $content = $content.Replace(
        '<a class="dropdown-item" href="instruction_ru.html">',
        '<a class="dropdown-item lang-switch" href="#" data-lang="ru">'
    )
    $outPath = Join-Path $OutDir "content.$lang.html"
    [System.IO.File]::WriteAllText($outPath, $content, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Wrote $outPath ($($content.Length) chars)"
}
