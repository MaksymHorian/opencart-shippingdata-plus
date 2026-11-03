# Extract single-file instruction body to content.uk.html (multilingual pipeline).
param(
    [Parameter(Mandatory = $true)]
    [string]$SourceHtml,
    [Parameter(Mandatory = $true)]
    [string]$OutDir
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$raw = [System.IO.File]::ReadAllText($SourceHtml, [System.Text.UTF8Encoding]::new($false))
if ($raw -notmatch '(?s)<div class="container-fluid">\s*(.*?)\s*<script type="text/javascript">') {
    throw "Cannot parse container body: $SourceHtml"
}
$content = $Matches[1]
$langSwitcher = @'
<div class="d-flex align-items-center">
                        <div class="dropdown mr-2">
                            <button class="btn btn-secondary dropdown-toggle" type="button" id="dropdownMenuButton1" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                UA
                            </button>
                            <div class="dropdown-menu" aria-labelledby="dropdownMenuButton1">
                                <a class="dropdown-item lang-switch" href="#" data-lang="uk">UA</a>
                                <a class="dropdown-item lang-switch" href="#" data-lang="en">EN</a>
                                <a class="dropdown-item lang-switch" href="#" data-lang="ru">RU</a>
                            </div>
                        </div>
                        <input id="input-text_to_find"
'@
$content = [regex]::Replace(
    $content,
    '(?s)<div class="form-inline my-2 my-lg-0">\s*<input id="input-text_to_find"',
    $langSwitcher,
    1
)
$outPath = Join-Path $OutDir 'content.uk.html'
[System.IO.File]::WriteAllText($outPath, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $outPath ($($content.Length) chars)"
