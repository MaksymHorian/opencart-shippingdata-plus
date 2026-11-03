# Build project handbook from docs/project/**/*.md — single md, html, or pdf.
# Usage: .\build-project-docs.ps1 [-Format md|html|pdf] [-ProjectRoot path]

param(
    [ValidateSet('md', 'html', 'pdf')]
    [string]$Format = 'pdf',
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
    param([string]$ScriptRoot)
    $packageRoot = Split-Path $ScriptRoot -Parent
    return Split-Path $packageRoot -Parent
}

function Get-OrderedProjectDocFiles {
    param([string]$DocsProjectRoot)
    $files = [System.Collections.Generic.List[string]]::new()
    $add = {
        param($rel)
        $full = Join-Path $DocsProjectRoot ($rel -replace '/', '\')
        if (Test-Path $full) { $files.Add($full) }
    }

    & $add 'README.md'
    & $add 'commands.md'
    & $add 'scripts.md'
    & $add 'team/README.md'
    Get-ChildItem (Join-Path $DocsProjectRoot 'team') -Filter '*.md' -File |
        Where-Object { $_.Name -ne 'README.md' } |
        Sort-Object Name |
        ForEach-Object { $files.Add($_.FullName) }
    Get-ChildItem (Join-Path $DocsProjectRoot 'workflows') -Filter '*.md' -File |
        Sort-Object Name |
        ForEach-Object { $files.Add($_.FullName) }

    return $files
}

function Get-RelativeDocTitle {
    param([string]$DocsProjectRoot, [string]$FilePath)
    $rel = $FilePath.Substring($DocsProjectRoot.Length).TrimStart('\', '/')
    return $rel -replace '\\', '/'
}

# Merged output lives in docs/project/_build/, so relative links written for the
# source file's own directory would resolve inside _build/ and break.
function Resolve-DocLinks {
    param([string]$Content, [string]$SourceFile, [string]$OutDir)
    $sourceDir = Split-Path $SourceFile -Parent
    $evaluator = {
        param($match)
        $label = $match.Groups[1].Value
        $target = $match.Groups[2].Value
        if ($target -match '^(https?:|mailto:|#|/)') { return $match.Value }
        $anchor = ''
        if ($target -match '^([^#]*)(#.*)$') {
            $target = $Matches[1]
            $anchor = $Matches[2]
        }
        if (-not $target) { return $match.Value }
        $full = [System.IO.Path]::GetFullPath((Join-Path $sourceDir ($target -replace '/', '\')))
        if (-not (Test-Path $full)) { return $match.Value }
        # Windows PowerShell 5.1 has no [System.IO.Path]::GetRelativePath.
        $fromUri = [Uri]::new($OutDir.TrimEnd('\', '/') + '\')
        $rebased = [Uri]::UnescapeDataString($fromUri.MakeRelativeUri([Uri]::new($full)).ToString())
        return "[$label]($rebased$anchor)"
    }
    return [regex]::Replace($Content, '\[([^\]]*)\]\(([^)\s]+)\)', $evaluator)
}

function Format-InlineMarkdown {
    param([string]$Text)
    $html = [System.Net.WebUtility]::HtmlEncode($Text)
    $html = [regex]::Replace($html, '\[([^\]]*)\]\(([^)\s]+)\)', '<a href="$2">$1</a>')
    $html = $html -replace '\*\*([^*]+)\*\*', '<strong>$1</strong>'
    $html = $html -replace '`([^`]+)`', '<code>$1</code>'
    return $html
}

function Convert-BasicMarkdownToHtml {
    param([string]$Markdown)
    $lines = $Markdown -split "`r?`n"
    $sb = [System.Text.StringBuilder]::new()
    $inCode = $false
    $inTable = $false
    $listOpen = $false

    function Close-List {
        param($Builder, [ref]$Open)
        if ($Open.Value) {
            [void]$Builder.AppendLine('</ul>')
            $Open.Value = $false
        }
    }

    foreach ($line in $lines) {
        if ($line -match '^```') {
            Close-List $sb ([ref]$listOpen)
            if (-not $inCode) {
                [void]$sb.AppendLine('<pre><code>')
                $inCode = $true
            } else {
                [void]$sb.AppendLine('</code></pre>')
                $inCode = $false
            }
            continue
        }
        if ($inCode) {
            $escaped = [System.Net.WebUtility]::HtmlEncode($line)
            [void]$sb.AppendLine($escaped)
            continue
        }

        if ($line -match '^\|(.+)\|$') {
            Close-List $sb ([ref]$listOpen)
            if (-not $inTable) {
                [void]$sb.AppendLine('<table>')
                $inTable = $true
            }
            $cells = ($line.Trim('|') -split '\|') | ForEach-Object { $_.Trim() }
            if ($cells -join '' -match '^[-:\s|]+$') { continue }
            [void]$sb.AppendLine('<tr>' + (($cells | ForEach-Object { '<td>' + (Format-InlineMarkdown -Text $_) + '</td>' }) -join '') + '</tr>')
            continue
        } elseif ($inTable -and $line -notmatch '^\|') {
            [void]$sb.AppendLine('</table>')
            $inTable = $false
        }

        if ($line -match '^(#{1,6})\s+(.+)$') {
            Close-List $sb ([ref]$listOpen)
            $level = $Matches[1].Length
            $text = [System.Net.WebUtility]::HtmlEncode($Matches[2])
            [void]$sb.AppendLine("<h$level>$text</h$level>")
            continue
        }

        if ($line -match '^-\s+(.+)$') {
            if (-not $listOpen) {
                [void]$sb.AppendLine('<ul>')
                $listOpen = $true
            }
            $text = Format-InlineMarkdown -Text $Matches[1]
            [void]$sb.AppendLine("<li>$text</li>")
            continue
        }

        if ($line -match '^\s*$') {
            Close-List $sb ([ref]$listOpen)
            [void]$sb.AppendLine('')
            continue
        }

        Close-List $sb ([ref]$listOpen)
        [void]$sb.AppendLine('<p>' + (Format-InlineMarkdown -Text $line) + '</p>')
    }

    Close-List $sb ([ref]$listOpen)
    if ($inTable) { [void]$sb.AppendLine('</table>') }
    if ($inCode) { [void]$sb.AppendLine('</code></pre>') }
    return $sb.ToString()
}

function Build-HandbookMarkdown {
    param([string[]]$Files, [string]$DocsProjectRoot, [string]$OutDir)
    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine('# OC Max Project Handbook')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm')")
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('Source: `docs/project/`')
    [void]$sb.AppendLine('')

    foreach ($file in $Files) {
        $title = Get-RelativeDocTitle -DocsProjectRoot $DocsProjectRoot -FilePath $file
        [void]$sb.AppendLine('')
        [void]$sb.AppendLine('---')
        [void]$sb.AppendLine('')
        [void]$sb.AppendLine("## Source: ``$title``")
        [void]$sb.AppendLine('')
        $content = [System.IO.File]::ReadAllText($file, [System.Text.UTF8Encoding]::new($false))
        $content = Resolve-DocLinks -Content $content -SourceFile $file -OutDir $OutDir
        [void]$sb.AppendLine($content)
    }
    return $sb.ToString()
}

function Build-HandbookHtml {
    param([string]$BodyHtml, [string]$Title)
    return @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>$Title</title>
    <style>
        body { font-family: Segoe UI, Arial, sans-serif; line-height: 1.5; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #222; }
        h1, h2, h3 { color: #111; page-break-after: avoid; }
        h2 { margin-top: 2rem; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; }
        pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; font-size: 0.85rem; }
        code { background: #f0f0f0; padding: 0.1em 0.35em; font-size: 0.9em; }
        table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.9rem; }
        td, th { border: 1px solid #ccc; padding: 0.4rem 0.6rem; vertical-align: top; }
        .section-break { page-break-before: always; margin-top: 0; }
        @media print { body { max-width: none; } a { color: #000; text-decoration: none; } }
    </style>
</head>
<body>
$BodyHtml
</body>
</html>
"@
}

function Invoke-Pandoc {
    param([string[]]$Arguments)
    $pandoc = Get-Command pandoc -ErrorAction SilentlyContinue
    if (-not $pandoc) { return $null }
    & $pandoc.Source @Arguments
    if ($LASTEXITCODE -ne 0) { throw "pandoc failed: $($Arguments -join ' ')" }
    return $true
}

function Invoke-EdgePrintToPdf {
    param([string]$HtmlPath, [string]$PdfPath)
    $candidates = @(
        "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    )
    $edge = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $edge) { return $false }

    $uri = ([Uri]::new($HtmlPath)).AbsoluteUri
    if (Test-Path $PdfPath) { Remove-Item $PdfPath -Force }
    $argList = @(
        '--headless=new',
        '--disable-gpu',
        "--print-to-pdf=$PdfPath",
        $uri
    )
    $proc = Start-Process -FilePath $edge -ArgumentList $argList -Wait -PassThru -NoNewWindow
    return ($proc.ExitCode -eq 0 -and (Test-Path $PdfPath))
}

$repoRoot = if ($ProjectRoot) { $ProjectRoot } else { Get-RepoRoot -ScriptRoot $PSScriptRoot }
$docsProject = Join-Path $repoRoot 'docs\project'
$outDir = Join-Path $docsProject '_build'

if (-not (Test-Path $docsProject)) {
    throw "docs/project not found: $docsProject"
}

$files = Get-OrderedProjectDocFiles -DocsProjectRoot $docsProject
if (-not $files.Count) {
    throw "No markdown files under docs/project"
}

New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$md = Build-HandbookMarkdown -Files $files -DocsProjectRoot $docsProject -OutDir $outDir
$mdPath = Join-Path $outDir 'project-handbook.md'
[System.IO.File]::WriteAllText($mdPath, $md, [System.Text.UTF8Encoding]::new($false))
Write-Host "Built: $mdPath ($($md.Length) bytes)"

$htmlPath = Join-Path $outDir 'project-handbook.html'
$pdfPath = Join-Path $outDir 'project-handbook.pdf'

if ($Format -eq 'md') {
    return [PSCustomObject]@{ Format = 'md'; Path = $mdPath; Files = $files.Count }
}

$htmlBody = [System.Text.StringBuilder]::new()
foreach ($file in $files) {
    $title = Get-RelativeDocTitle -DocsProjectRoot $docsProject -FilePath $file
    $content = [System.IO.File]::ReadAllText($file, [System.Text.UTF8Encoding]::new($false))
    $content = Resolve-DocLinks -Content $content -SourceFile $file -OutDir $outDir
    [void]$htmlBody.AppendLine("<div class=`"section-break`"><h1>$title</h1>")
    [void]$htmlBody.AppendLine((Convert-BasicMarkdownToHtml -Markdown $content))
    [void]$htmlBody.AppendLine('</div>')
}

$html = Build-HandbookHtml -BodyHtml $htmlBody.ToString() -Title 'OC Max Project Handbook'
[System.IO.File]::WriteAllText($htmlPath, $html, [System.Text.UTF8Encoding]::new($false))
Write-Host "Built: $htmlPath ($($html.Length) bytes)"

if ($Format -eq 'html') {
    return [PSCustomObject]@{ Format = 'html'; Path = $htmlPath; Markdown = $mdPath; Files = $files.Count }
}

$pdfOk = $false
if (Invoke-Pandoc @($mdPath, '-o', $pdfPath, '--toc', '-V', 'geometry:margin=2cm') -eq $true) {
    $pdfOk = $true
    Write-Host "Built (pandoc): $pdfPath"
} elseif (Invoke-EdgePrintToPdf -HtmlPath $htmlPath -PdfPath $pdfPath) {
    $pdfOk = $true
    Write-Host "Built (Edge print): $pdfPath"
}

if (-not $pdfOk) {
    Write-Warning "PDF not created. Install pandoc or use Edge. Open HTML and Print to PDF: $htmlPath"
    return [PSCustomObject]@{ Format = 'html-only'; Path = $htmlPath; Markdown = $mdPath; Pdf = $null; Files = $files.Count }
}

return [PSCustomObject]@{
    Format   = 'pdf'
    Path     = $pdfPath
    Html     = $htmlPath
    Markdown = $mdPath
    Files    = $files.Count
}
