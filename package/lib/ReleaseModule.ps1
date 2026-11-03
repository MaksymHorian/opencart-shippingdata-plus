# Shared release library — module-agnostic helpers (Variant A: per-module manifest).

# UI build-state hash helpers shared with scripts/build-ui.ps1 (feature 004 T028/T029).
. (Join-Path $PSScriptRoot 'UiBuildState.ps1')

function Get-ReleasePackageRoot {
    $dir = $PSScriptRoot
    if ($dir -match '[\\/]lib$' -or $dir -match '[\\/]scripts$') {
        return Split-Path $dir -Parent
    }
    throw 'ReleaseModule.ps1 must live in package/lib/'
}

function Import-ReleaseManifest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Module
    )
    $packageRoot = Get-ReleasePackageRoot
    $manifestPath = Join-Path $packageRoot "modules\$Module\manifest.json"
    if (-not (Test-Path $manifestPath)) {
        $available = @(Get-ChildItem (Join-Path $packageRoot 'modules') -Directory |
            Where-Object { $_.Name -ne '_template' } |
            ForEach-Object { $_.Name }) -join ', '
        throw "Unknown module '$Module'. Available: $available"
    }
    return Get-Content $manifestPath -Raw | ConvertFrom-Json
}

function Get-ReleasePaths {
    param($Manifest, [string]$VersionFolder)
    $homeRoot = $Manifest.paths.homeRoot
    $versionRoot = if ($VersionFolder) { Join-Path $homeRoot "OCMax\$($Manifest.paths.ocMaxProduct)\$VersionFolder" } else { $null }
    [PSCustomObject]@{
        HomeRoot     = $homeRoot
        DevSandbox   = Join-Path $homeRoot $Manifest.paths.devSandbox
        OcMaxRoot    = Join-Path $homeRoot "OCMax\$($Manifest.paths.ocMaxProduct)"
        VersionRoot  = $versionRoot
        RepoRoot     = Join-Path $homeRoot "REPO\$($Manifest.paths.repoName)"
        DocsSource   = Join-Path $homeRoot "$($Manifest.paths.devSandbox)\$($Manifest.paths.docsRelative)"
        PackageRoot  = Get-ReleasePackageRoot
        Module       = $Manifest.module
    }
}

function Get-ModuleScreenshotPaths {
    param($Manifest)
    $paths = Get-ReleasePaths -Manifest $Manifest
    $outRel = 'images'
    $specRel = 'images'
    if ($Manifest.PSObject.Properties['screenshots']) {
        if ($Manifest.screenshots.outputRelativeToOcMax) {
            $outRel = $Manifest.screenshots.outputRelativeToOcMax
        }
        if ($Manifest.screenshots.specRelativeToDocs) {
            $specRel = $Manifest.screenshots.specRelativeToDocs
        }
    }
    $specDir = Join-Path $paths.DocsSource $specRel
    [PSCustomObject]@{
        OutputDir  = Join-Path $paths.OcMaxRoot $outRel
        SpecDir    = $specDir
        SpecFile   = Join-Path $specDir 'SCREENSHOTS.md'
        OcMaxRoot  = $paths.OcMaxRoot
        DocsSource = $paths.DocsSource
    }
}

function Get-ModuleVersionFromController {
    param(
        [string]$SandboxRoot,
        [string]$ControllerRel
    )
    $path = Join-Path $SandboxRoot $ControllerRel
    if (-not (Test-Path $path)) {
        throw "Version controller not found: $path"
    }
    $content = Get-Content $path -Raw -Encoding UTF8
    if ($content -match "protected\s+\`$version\s*=\s*'([^']+)'") {
        return $Matches[1]
    }
    throw "Cannot parse protected `$version from $path"
}

function Format-OcMaxVersionFolder {
    param([string]$Version)
    if ($Version -match '^\s*v\.\s*') {
        return ($Version -replace '^\s+|\s+$', '')
    }
    return "v. $Version"
}

function Resolve-ReleaseVersion {
    param(
        $Manifest,
        [string]$VersionOverride
    )
    if ($VersionOverride) {
        return (Format-OcMaxVersionFolder $VersionOverride)
    }
    if (($Manifest.PSObject.Properties.Name -contains 'version') -and $Manifest.version -and
        ($Manifest.version.PSObject.Properties.Name -contains 'controller') -and
        $Manifest.version.controller) {
        $paths = Get-ReleasePaths -Manifest $Manifest
        $semver = Get-ModuleVersionFromController -SandboxRoot $paths.DevSandbox -ControllerRel $Manifest.version.controller
        return (Format-OcMaxVersionFolder $semver)
    }
    if (($Manifest.PSObject.Properties.Name -contains 'versionDefault') -and $Manifest.versionDefault) {
        return (Format-OcMaxVersionFolder $Manifest.versionDefault)
    }
    throw "manifest.json must define version.controller or versionDefault for module $($Manifest.module)"
}

function Ensure-OcMaxVersionLayout {
    param(
        $Manifest,
        [string]$VersionFolder
    )
    $paths = Get-ReleasePaths -Manifest $Manifest -VersionFolder $VersionFolder
    $created = $false
    if (-not (Test-Path $paths.VersionRoot)) {
        New-Item -ItemType Directory -Path $paths.VersionRoot -Force | Out-Null
        $created = $true
        Write-Host "Created version folder: $($paths.VersionRoot)"
    }
    $originalRoot = Join-Path $paths.VersionRoot 'original'
    if (-not (Test-Path $originalRoot)) {
        New-Item -ItemType Directory -Path $originalRoot -Force | Out-Null
        Write-Host "Created: $originalRoot"
    }
    if ($created -and $Manifest.releaseAssets.seedFromVersion) {
        $seedRoot = Join-Path $paths.OcMaxRoot $Manifest.releaseAssets.seedFromVersion
        if (Test-Path $seedRoot) {
            foreach ($file in (Get-ReleaseRootFileNames -Manifest $Manifest)) {
                $src = Join-Path $seedRoot $file
                if (Test-Path $src) {
                    Copy-Item $src (Join-Path $paths.VersionRoot $file) -Force
                }
            }
            foreach ($dir in $Manifest.releaseAssets.rootDirs) {
                $srcDir = Join-Path $seedRoot $dir
                $dstDir = Join-Path $paths.VersionRoot $dir
                if (Test-Path $srcDir) {
                    if (Test-Path $dstDir) { Remove-Item $dstDir -Recurse -Force }
                    Copy-Item $srcDir $dstDir -Recurse -Force
                }
            }
            Write-Host "Seeded assets from $($Manifest.releaseAssets.seedFromVersion)"
        }
    }
    return $paths
}

function Get-ReleaseRootFileNames {
    param($Manifest)
    $names = [System.Collections.Generic.List[string]]::new()
    foreach ($file in @($Manifest.releaseAssets.rootFiles)) {
        if ($file -and -not $names.Contains([string]$file)) {
            $names.Add([string]$file)
        }
    }
    foreach ($file in @(
            'license.md',
            'license-en.md',
            'third-party-licences.md',
            'third-party-licences-en.md'
        )) {
        if (-not $names.Contains($file)) {
            $names.Add($file)
        }
    }
    return $names
}

function Sync-ReleaseRootDocs {
    param(
        $Manifest,
        [string]$VersionRoot
    )
    if (-not $VersionRoot -or -not (Test-Path $VersionRoot)) {
        return
    }
    $paths = Get-ReleasePaths -Manifest $Manifest
    foreach ($file in (Get-ReleaseRootFileNames -Manifest $Manifest)) {
        $src = Join-Path $paths.DocsSource $file
        if (Test-Path $src) {
            Copy-Item $src (Join-Path $VersionRoot $file) -Force
            Write-Host "Root doc: $file"
        }
    }
}

function Sync-SharedExtraAssets {
    param(
        [string]$SourceRoot,
        [string]$DestRoot,
        $Manifest
    )
    if (-not $Manifest.releaseAssets.sharedExtraRelative) {
        return
    }
    $srcDir = Join-Path $SourceRoot $Manifest.releaseAssets.sharedExtraRelative
    if (-not (Test-Path $srcDir)) {
        Write-Warning "Shared extra not found: $srcDir"
        return
    }
    foreach ($dir in $Manifest.releaseAssets.rootDirs) {
        if ($dir -ne 'extra') {
            continue
        }
        $dstDir = Join-Path $DestRoot $dir
        if (Test-Path $dstDir) {
            Remove-Item $dstDir -Recurse -Force
        }
        Copy-Item $srcDir $dstDir -Recurse -Force
        Write-Host "Synced extra: $srcDir -> $dstDir"
    }
}

function Copy-MappedFile {
    param(
        [string]$SourcePath,
        [string[]]$DestPaths,
        [hashtable]$Stats
    )
    if (-not (Test-Path $SourcePath)) {
        $Stats.Warnings += "Missing source: $SourcePath"
        return
    }
    foreach ($dest in $DestPaths) {
        $destDir = Split-Path $dest -Parent
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Copy-Item -Path $SourcePath -Destination $dest -Force
        $Stats.Copied++
        $Stats.Files += $dest
    }
}

function Get-Oc15AdminAssetPackageMaps {
    return @(
        [PSCustomObject]@{
            type             = 'directory'
            srcFromPackage   = 'assets\oc15-admin\admin\view\javascript\ocmax'
            dst              = 'admin\view\javascript\ocmax'
        },
        [PSCustomObject]@{
            type             = 'directory'
            srcFromPackage   = 'assets\oc15-admin\admin\view\stylesheet\ocmax'
            dst              = 'admin\view\stylesheet\ocmax'
        }
    )
}

function Get-Oc15AdminBuildUploadPaths {
    return @(
        'admin\view\javascript\ocmax\ocmax.js',
        'admin\view\javascript\ocmax\moment.min.js',
        'admin\view\javascript\ocmax\bootstrap-datetimepicker.min.js',
        'admin\view\stylesheet\ocmax\bootstrap.fix.css',
        'admin\view\stylesheet\ocmax\bootstrap-datetimepicker.min.css'
    )
}

function Get-ManifestPropagateAssetMaps {
    param(
        $Manifest,
        [string]$Target
    )

    $maps = @()
    if ($Manifest.propagate.assets.$Target) {
        $maps += @($Manifest.propagate.assets.$Target)
    }
    if ($Target -eq 'oc15' -and $Manifest.sharedLayers.oc15AdminAssets) {
        $maps += Get-Oc15AdminAssetPackageMaps
    }
    return $maps
}

function Get-ManifestBuildUploadPaths {
    param(
        $Manifest,
        [string]$Key
    )

    $paths = @()
    if ($Manifest.build.upload.$Key) {
        $paths += @($Manifest.build.upload.$Key)
    }
    if ($Key -eq 'oc15' -and $Manifest.sharedLayers.oc15AdminAssets) {
        foreach ($rel in Get-Oc15AdminBuildUploadPaths) {
            if ($paths -notcontains $rel) {
                $paths += $rel
            }
        }
    }
    return $paths
}

function Copy-PackageAssetMaps {
    param(
        $Manifest,
        [string]$Target,
        [string]$TargetRoot,
        [hashtable]$Stats
    )

    $assetMaps = Get-ManifestPropagateAssetMaps -Manifest $Manifest -Target $Target
    if (-not $assetMaps -or $assetMaps.Count -eq 0) {
        return
    }

    $packageRoot = Get-ReleasePackageRoot
    foreach ($map in $assetMaps) {
        $src = Join-Path $packageRoot $map.srcFromPackage
        $dst = Join-Path $TargetRoot $map.dst
        if ($map.type -eq 'directory') {
            if (-not (Test-Path $src)) {
                $Stats.Warnings += "Missing package asset dir: $src"
                continue
            }
            if (Test-Path $dst) {
                Remove-Item $dst -Recurse -Force
            }
            $parent = Split-Path $dst -Parent
            if (-not (Test-Path $parent)) {
                New-Item -ItemType Directory -Path $parent -Force | Out-Null
            }
            Copy-Item -Path $src -Destination $dst -Recurse -Force
            $fileCount = (Get-ChildItem -Path $dst -Recurse -File).Count
            $Stats.Copied += $fileCount
            continue
        }

        Copy-MappedFile -SourcePath $src -DestPaths @($dst) -Stats $Stats
    }
}

function Get-LangPairsForTarget {
    param(
        $Manifest,
        [string]$Target,
        [string]$Locale
    )
    $cfg = $Manifest.propagate.lang.$Target
    $pairs = @()
    $name = $Manifest.module
    $langFiles = @(
        @{ Area = 'admin'; Sub = "extension\shipping\$name.php"; LegacySub = "shipping\$name.php" }
        @{ Area = 'admin'; Sub = 'extension\module\ocmax_license.php'; LegacySub = 'module\ocmax_license.php' }
        @{ Area = 'catalog'; Sub = "extension\shipping\$name.php"; LegacySub = "shipping\$name.php" }
    )
    if (-not $Manifest.sharedLayers.ocmax_license) {
        $langFiles = $langFiles | Where-Object { $_.Sub -notmatch 'ocmax_license' }
    }
    foreach ($lf in $langFiles) {
        $src = "$($lf.Area)\language\$Locale\$($lf.Sub)"
        switch ($cfg.strategy) {
            'mirror-extension' {
                $pairs += @{ Src = $src; Dst = @($src) }
            }
            'duplicate-legacy' {
                $dsts = $cfg.localeMap.$Locale | ForEach-Object { "$($lf.Area)\language\$_\$($lf.LegacySub)" }
                $pairs += @{ Src = $src; Dst = $dsts }
            }
            'legacy-single' {
                $folder = $cfg.localeMap.$Locale
                $pairs += @{ Src = $src; Dst = @("$($lf.Area)\language\$folder\$($lf.LegacySub)") }
            }
        }
    }
    return $pairs
}

function Get-PropagateStatePath {
    param($Manifest)
    Join-Path (Get-ReleasePackageRoot) "modules\$($Manifest.module)\.propagate-state.json"
}

function Get-TwigContentHash {
    param([string]$FilePath)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    ([BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-', '').ToLower()
}

function Get-PropagateTwigState {
    param([string]$StatePath)
    if (-not (Test-Path $StatePath)) {
        return @{}
    }
    $json = Get-Content $StatePath -Raw -Encoding UTF8 | ConvertFrom-Json
    $map = @{}
    if ($json.twig) {
        $json.twig.PSObject.Properties | ForEach-Object { $map[$_.Name] = $_.Value }
    }
    return $map
}

function Save-PropagateTwigState {
    param(
        [string]$StatePath,
        [hashtable]$TwigHashes
    )
    $payload = @{ twig = $TwigHashes; updatedAt = (Get-Date).ToString('o') }
    $payload | ConvertTo-Json -Depth 4 | Set-Content $StatePath -Encoding UTF8
}

function Invoke-ModulePropagate {
    param(
        [Parameter(Mandatory = $true)]
        $Manifest,
        [ValidateSet('changed', 'full')]
        [string]$Templates = 'changed'
    )
    $libDir = Join-Path (Get-ReleasePackageRoot) 'lib'
    . (Join-Path $libDir 'TwigToTpl.ps1')
    . (Join-Path $libDir 'TplAdaptations.ps1')

    $paths = Get-ReleasePaths -Manifest $Manifest
    $sourceRoot = $paths.DevSandbox
    $statePath = Get-PropagateStatePath -Manifest $Manifest
    $twigState = Get-PropagateTwigState -StatePath $statePath
    $twigHashesAfter = @{}
    $results = @()

    foreach ($target in $Manifest.propagate.targets) {
        $targetRoot = Join-Path $paths.HomeRoot $target
        if (-not (Test-Path $targetRoot)) {
            Write-Warning "Target sandbox missing: $targetRoot"
            continue
        }

        $stats = @{
            Copied   = 0
            Files    = [System.Collections.Generic.List[string]]::new()
            Warnings = [System.Collections.Generic.List[string]]::new()
        }

        foreach ($map in $Manifest.propagate.php.$target) {
            $src = Join-Path $sourceRoot $map.src
            $dst = Join-Path $targetRoot $map.dst
            Copy-MappedFile -SourcePath $src -DestPaths @($dst) -Stats $stats
        }

        Copy-PackageAssetMaps -Manifest $Manifest -Target $target -TargetRoot $targetRoot -Stats $stats

        foreach ($locale in $Manifest.propagate.lang.locales) {
            $pairs = Get-LangPairsForTarget -Manifest $Manifest -Target $target -Locale $locale
            foreach ($pair in $pairs) {
                $srcPath = Join-Path $sourceRoot $pair.Src
                $destPaths = $pair.Dst | ForEach-Object { Join-Path $targetRoot $_ }
                Copy-MappedFile -SourcePath $srcPath -DestPaths $destPaths -Stats $stats
            }
        }

        $templateCount = 0
        $templateSkipped = 0
        if ($Manifest.propagate.templates.$target) {
            $replacements = @()
            if ($Manifest.propagate.tplReplacements.$target) {
                $replacements = @($Manifest.propagate.tplReplacements.$target)
            }
            foreach ($tmpl in $Manifest.propagate.templates.$target) {
                $twigPath = Join-Path $sourceRoot $tmpl.src
                if (-not (Test-Path $twigPath)) {
                    $stats.Warnings += "Missing twig: $twigPath"
                    continue
                }
                $normSrc = ($tmpl.src -replace '\\', '/')
                $hash = Get-TwigContentHash -FilePath $twigPath
                $twigHashesAfter[$normSrc] = $hash

                $destPath = Join-Path $targetRoot $tmpl.dst
                $prevHash = $twigState[$normSrc]
                $shouldConvert = ($Templates -eq 'full') -or -not (Test-Path $destPath) -or ($prevHash -ne $hash)

                if (-not $shouldConvert) {
                    $templateSkipped++
                    continue
                }

                $raw = Get-Content $twigPath -Raw -Encoding UTF8
                $tpl = Convert-OcmaxTwigToTpl -Content $raw
                $tpl = Apply-TplReplacements -Content $tpl -Replacements $replacements
                $tpl = Apply-TplTargetAdaptations -Content $tpl -Target $target -Manifest $Manifest
                $destDir = Split-Path $destPath -Parent
                if (-not (Test-Path $destDir)) {
                    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
                }
                [System.IO.File]::WriteAllText($destPath, $tpl, [System.Text.UTF8Encoding]::new($false))
                $stats.Copied++
                $templateCount++
                $stats.Files += $tmpl.dst
            }
        }

        $results += [PSCustomObject]@{
            Target           = $target
            Copied           = $stats.Copied
            Templates        = $templateCount
            TemplatesSkipped = $templateSkipped
            Warnings         = $stats.Warnings
        }

        Write-Host "[$target] copied $($stats.Copied) file(s) (templates: $templateCount, skipped: $templateSkipped)"
        if ($stats.Warnings.Count -gt 0) {
            $stats.Warnings | ForEach-Object { Write-Warning $_ }
        }
    }

    if ($twigHashesAfter.Count -gt 0) {
        Save-PropagateTwigState -StatePath $statePath -TwigHashes $twigHashesAfter
        Write-Host "Template state saved: $statePath"
    }

    return $results
}

function Ensure-Dir([string]$Path) {
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Copy-Relative {
    param(
        [string]$SourceRoot,
        [string]$DestRoot,
        [string]$RelativePath,
        [ref]$Count
    )
    $src = Join-Path $SourceRoot $RelativePath
    if (-not (Test-Path $src)) {
        Write-Warning "Missing: $src"
        return
    }
    $dest = Join-Path $DestRoot $RelativePath
    Ensure-Dir (Split-Path $dest -Parent)
    Copy-Item -Path $src -Destination $dest -Force
    $Count.Value++
}

function Copy-LangFilesForBuild {
    param(
        [string]$SandboxRoot,
        [string]$UploadDest,
        [string[]]$Filters,
        [ref]$Count
    )
    foreach ($langRoot in @('admin\language', 'catalog\language')) {
        $srcLang = Join-Path $SandboxRoot $langRoot
        if (-not (Test-Path $srcLang)) { continue }
        foreach ($filter in $Filters) {
            Get-ChildItem -Path $srcLang -Recurse -Filter $filter -File | ForEach-Object {
                $rel = $_.FullName.Substring($SandboxRoot.Length).TrimStart('\')
                Copy-Relative -SourceRoot $SandboxRoot -DestRoot $UploadDest -RelativePath $rel -Count $Count
            }
        }
    }
}

function New-OcmodInstallerZip {
    param(
        [string]$SourceXmlPath,
        [string]$DestZipPath,
        [string]$UploadRoot
    )
    if (-not (Test-Path $SourceXmlPath)) {
        throw "OCMOD source not found: $SourceXmlPath"
    }
    if ($UploadRoot -and (Test-Path $UploadRoot)) {
        New-FullOcmodInstallerZip -SourceXmlPath $SourceXmlPath -UploadRoot $UploadRoot -DestZipPath $DestZipPath
        return
    }
    $tempDir = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    try {
        $installXml = Join-Path $tempDir 'install.xml'
        Copy-Item $SourceXmlPath $installXml -Force
        if (Test-Path $DestZipPath) {
            Remove-Item $DestZipPath -Force
        }
        Compress-Archive -Path $installXml -DestinationPath $DestZipPath -CompressionLevel Optimal
    }
    finally {
        Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function New-FullOcmodInstallerZip {
    # OpenCart extension installer: install.xml at archive root plus upload/ with forward-slash paths.
    param(
        [Parameter(Mandatory = $true)][string]$SourceXmlPath,
        [Parameter(Mandatory = $true)][string]$UploadRoot,
        [Parameter(Mandatory = $true)][string]$DestZipPath
    )
    if (-not (Test-Path $UploadRoot)) {
        throw "OCMOD upload tree not found: $UploadRoot"
    }
    if (Test-Path $DestZipPath) {
        Remove-Item $DestZipPath -Force
    }
    Add-Type -AssemblyName System.IO.Compression | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
    $stream = [System.IO.File]::Open($DestZipPath, [System.IO.FileMode]::CreateNew)
    $zip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip, $SourceXmlPath, 'install.xml',
            [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        foreach ($f in @(Get-ChildItem -Path $UploadRoot -Recurse -File | Sort-Object FullName)) {
            $rel = $f.FullName.Substring($UploadRoot.Length).TrimStart('\')
            $entryName = 'upload/' + (($rel -split '\\') -join '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zip, $f.FullName, $entryName,
                [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    }
    finally {
        $zip.Dispose()
        $stream.Dispose()
    }
    Write-Host "Full OCMOD installer zip: $DestZipPath"
}

function Copy-OcmodMods {
    param(
        [string]$SandboxRoot,
        [string]$ModDest,
        [string]$Glob,
        [ref]$Count,
        [switch]$CreateInstallerZips
    )
    $src = Join-Path $SandboxRoot 'system'
    Get-ChildItem -Path $src -Filter $Glob -File -ErrorAction SilentlyContinue | ForEach-Object {
        Ensure-Dir $ModDest
        $destXml = Join-Path $ModDest $_.Name
        Copy-Item $_.FullName -Destination $destXml -Force
        $Count.Value++
        if ($CreateInstallerZips) {
            $zipName = $_.Name -replace '\.ocmod\.xml$', '.ocmod.zip'
            if ($zipName -eq $_.Name) {
                $zipName = $_.Name -replace '\.xml$', '.zip'
            }
            $uploadRoot = Join-Path (Split-Path $ModDest -Parent) 'upload'
            New-OcmodInstallerZip -SourceXmlPath $destXml -DestZipPath (Join-Path $ModDest $zipName) `
                -UploadRoot $uploadRoot
            $Count.Value++
        }
    }
}

function Get-OcmodInstallerZipOcFolder {
    param($Manifest)
    foreach ($entry in $Manifest.build.versions) {
        if ($entry.ocmodInstallerZip) {
            return $entry.ocmaxFolder
        }
    }
    return $null
}

function Remove-OcmodSourceXmlFromBand {
    param(
        [string]$BandRoot,
        [string]$OcFolder
    )
    if (-not $OcFolder) {
        return
    }
    $modDest = Join-Path $BandRoot ($OcFolder + '\modification')
    if (-not (Test-Path $modDest)) {
        return
    }
    Get-ChildItem -Path $modDest -Filter '*.ocmod.xml' -File -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item $_.FullName -Force
        Write-Host "Removed from customer band: $($_.Name)"
    }
}

function Copy-VqmodMods {
    param(
        [string]$SandboxRoot,
        [string]$ModDest,
        [string]$Glob,
        [bool]$StripTrailingUnderscore,
        [ref]$Count
    )
    $src = Join-Path $SandboxRoot 'vqmod\xml'
    if (-not (Test-Path $src)) {
        Write-Warning "VQMod path missing: $src"
        return
    }
    Ensure-Dir $ModDest
    Get-ChildItem -Path $src -Filter $Glob -File | ForEach-Object {
        $name = $_.Name
        if ($StripTrailingUnderscore -and ($name -match '_\.xml$')) {
            $releaseName = $name -replace '_(?=\.xml$)', ''
            Copy-Item $_.FullName -Destination (Join-Path $ModDest $releaseName) -Force
            $Count.Value++
            return
        }
        Copy-Item $_.FullName -Destination (Join-Path $ModDest $name) -Force
        $Count.Value++
    }
}

# ---------------------------------------------------------------------------
# Feature 004 (novaposhta_pro): UI build-state gate (T029), glob-generated
# encodePaths (T030), sentinel injection + post-encode assertions (T031/T032)
# and the per-band installer zip (T034).
# ---------------------------------------------------------------------------

function Test-ModuleHasUiWorkspace {
    param([Parameter(Mandatory = $true)]$Manifest)
    return (Test-Path (Join-Path (Get-ReleasePackageRoot) "ui\$($Manifest.module)"))
}

function Assert-UiBuildState {
    # T029: a module with a UI workspace (package/ui/<module>) may only build
    # when the deployed bundle matches the stamped state of the current UI
    # sources — a stale bundle can never ship. Hash logic lives in
    # lib/UiBuildState.ps1, shared with scripts/build-ui.ps1.
    param([Parameter(Mandatory = $true)]$Manifest)
    if (-not (Test-ModuleHasUiWorkspace -Manifest $Manifest)) {
        return
    }

    $packageRoot = Get-ReleasePackageRoot
    $module = $Manifest.module
    $fix = "Run: powershell -File $packageRoot\scripts\build-ui.ps1 -Module $module"

    $statePath = Get-UiBuildStatePath -PackageRoot $packageRoot -Module $module
    if (-not (Test-Path $statePath)) {
        throw "UI build state missing: $statePath - the SPA bundle was never stamped. $fix"
    }
    $state = Get-Content $statePath -Raw -Encoding UTF8 | ConvertFrom-Json

    $workspaceRoot = Get-UiWorkspaceRoot -PackageRoot $packageRoot -Module $module
    $freshSourceHash = Get-UiSourceHash -WorkspaceRoot $workspaceRoot
    if ($freshSourceHash -ne $state.sourceHash) {
        throw ("UI sources changed since the last UI build " +
            "(stamped $($state.sourceHash), current $freshSourceHash) - stale bundle. $fix")
    }

    $distDir = Get-UiDistDir -Manifest $Manifest
    $drift = @()
    foreach ($prop in $state.dist.PSObject.Properties) {
        $file = Join-Path $distDir ($prop.Name -replace '/', '\')
        if (-not (Test-Path $file)) {
            $drift += "missing: $($prop.Name)"
            continue
        }
        if ((Get-FileSha256Hex -Path $file) -ne $prop.Value) {
            $drift += "hash mismatch: $($prop.Name)"
        }
    }
    if ($drift.Count -gt 0) {
        throw ("Deployed UI bundle in $distDir differs from .ui-build-state.json:`n  " +
            ($drift -join "`n  ") + "`n$fix")
    }

    # The stamped dist set must equal the manifest's upload list under
    # admin\view\javascript\<module>: a newly emitted bundle file that is
    # missing from build.upload would be stamped as valid yet silently
    # absent from the customer ZIP (and vice versa - a listed file the
    # build no longer emits).
    $assetPrefix = "admin\view\javascript\$module\"
    $manifestSet = @{}
    foreach ($entry in $Manifest.build.upload.oc3) {
        if ($entry.StartsWith($assetPrefix)) {
            $manifestSet[($entry.Substring($assetPrefix.Length) -replace '\\', '/')] = $true
        }
    }
    $mismatch = @()
    foreach ($prop in $state.dist.PSObject.Properties) {
        if (-not $manifestSet.ContainsKey($prop.Name)) {
            $mismatch += "built but not in manifest build.upload: $($prop.Name)"
        }
    }
    foreach ($rel in $manifestSet.Keys) {
        $found = $false
        foreach ($prop in $state.dist.PSObject.Properties) {
            if ($prop.Name -eq $rel) { $found = $true; break }
        }
        if (-not $found) {
            $mismatch += "in manifest build.upload but not built: $rel"
        }
    }
    if ($mismatch.Count -gt 0) {
        throw ("UI dist set and manifest build.upload disagree for ${module}:`n  " +
            (($mismatch | Sort-Object) -join "`n  "))
    }
    Write-Host "UI build state OK: $statePath"
}

function Test-ModuleUsesEncodeGlobs {
    param([Parameter(Mandatory = $true)]$Manifest)
    if (-not ($Manifest.PSObject.Properties.Name -contains 'ioncube')) {
        return $false
    }
    $ic = $Manifest.ioncube
    return [bool](($ic.PSObject.Properties.Name -contains 'encodeGlobs') -and $ic.encodeGlobs)
}

function Convert-EncodeGlobToRegex {
    # Minimal glob -> anchored regex for ioncube.encodeGlobs entries.
    # '**\' spans zero or more directories; '*' and '?' never cross '\'.
    param([Parameter(Mandatory = $true)][string]$Glob)
    $ph = [string][char]1
    $norm = ($Glob -replace '/', '\').Replace('**', $ph)
    $pattern = [regex]::Escape($norm)
    $pattern = $pattern.Replace($ph + '\\', '(?:.*\\)?')
    $pattern = $pattern.Replace($ph, '.*')
    $pattern = $pattern.Replace('\*', '[^\\]*')
    $pattern = $pattern.Replace('\?', '[^\\]')
    return '^(?i)' + $pattern + '$'
}

function Get-PlaintextAllowlistRelativePaths {
    param([Parameter(Mandatory = $true)]$Manifest)
    $ic = $Manifest.ioncube
    if (($ic.PSObject.Properties.Name -contains 'plaintextAllowlist') -and $ic.plaintextAllowlist) {
        return @($ic.plaintextAllowlist | ForEach-Object { $_ -replace '/', '\' })
    }
    return @()
}

function Get-EffectiveEncodeRelativePaths {
    # T030: expand ioncube.encodeGlobs over original/ into individual relative
    # file paths and subtract ioncube.plaintextAllowlist. Falls back to the
    # literal ioncube.encodePaths when encodeGlobs is absent (legacy modules).
    param(
        [Parameter(Mandatory = $true)]$Manifest,
        [Parameter(Mandatory = $true)][string]$OriginalRoot
    )
    $ic = $Manifest.ioncube
    if (-not (Test-ModuleUsesEncodeGlobs -Manifest $Manifest)) {
        return @($ic.encodePaths)
    }
    $allow = @{}
    foreach ($rel in (Get-PlaintextAllowlistRelativePaths -Manifest $Manifest)) {
        $allow[$rel.ToLowerInvariant()] = $true
    }
    $regexes = @($ic.encodeGlobs | ForEach-Object { Convert-EncodeGlobToRegex -Glob $_ })
    $result = New-Object System.Collections.Generic.List[string]
    Get-ChildItem -Path $OriginalRoot -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($OriginalRoot.Length).TrimStart('\')
        foreach ($rx in $regexes) {
            if ($rel -match $rx) {
                if (-not $allow.ContainsKey($rel.ToLowerInvariant())) {
                    $result.Add($rel)
                }
                break
            }
        }
    }
    return @($result | Sort-Object)
}

function Get-ModuleEncodeStatePath {
    param([Parameter(Mandatory = $true)]$Manifest)
    return Join-Path (Get-ReleasePackageRoot) "modules\$($Manifest.module)\.encode-state.json"
}

function Add-EncodeSentinel {
    # T031: inject a per-build sentinel comment as the first line after <?php
    # into every ORIGINAL-staging file that will be encoded — never the dev
    # sandbox, never the plaintext allowlist. Post-encode, assertion 2 proves
    # no band file still carries the sentinel (= no protected source shipped
    # in plaintext). The hex is remembered in .encode-state.json.
    param(
        [Parameter(Mandatory = $true)]$Manifest,
        [Parameter(Mandatory = $true)][string]$OriginalRoot
    )
    $hex = [Guid]::NewGuid().ToString('N').Substring(0, 12)
    $sentinel = "/*NPP-SRC-$hex*/"
    $encodeRel = @(Get-EffectiveEncodeRelativePaths -Manifest $Manifest -OriginalRoot $OriginalRoot)
    if ($encodeRel.Count -eq 0) {
        throw "Sentinel injection found no encode source files under $OriginalRoot"
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    foreach ($rel in $encodeRel) {
        $file = Join-Path $OriginalRoot $rel
        $text = [System.IO.File]::ReadAllText($file)
        if (-not $text.StartsWith('<?php')) {
            throw "Cannot inject sentinel (file does not start with <?php): $file"
        }
        $text = '<?php' + "`n" + $sentinel + $text.Substring(5)
        [System.IO.File]::WriteAllText($file, $text, $utf8NoBom)
    }
    $state = [ordered]@{
        sentinel  = $hex
        createdAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        files     = @($encodeRel | ForEach-Object { $_ -replace '\\', '/' })
    }
    $statePath = Get-ModuleEncodeStatePath -Manifest $Manifest
    $state | ConvertTo-Json -Depth 4 | Set-Content $statePath -Encoding UTF8
    Write-Host "Sentinel NPP-SRC-$hex injected into $($encodeRel.Count) encode source file(s)"
    return $hex
}

function Get-RelativeFileSet {
    # Case-insensitive map of lowercased relative path -> original-cased path.
    param([Parameter(Mandatory = $true)][string]$Root)
    $set = @{}
    if (Test-Path $Root) {
        Get-ChildItem -Path $Root -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($Root.Length).TrimStart('\')
            $set[$rel.ToLowerInvariant()] = $rel
        }
    }
    return $set
}

function Test-IonCubeStubFile {
    # ionCube-encoded files start with the loader stub. Single-version
    # encodings use the '<?php //0' prefix family (e.g. "<?php //004fb...");
    # multi-version bundles (bundle / add-to-bundle steps) use the ICB
    # bundle header (e.g. "<?php //ICB0 72:0 74:814").
    param([Parameter(Mandatory = $true)][string]$Path)
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $buf = New-Object byte[] 16
        $read = $stream.Read($buf, 0, 16)
        $head = [System.Text.Encoding]::ASCII.GetString($buf, 0, $read)
    }
    finally {
        $stream.Dispose()
    }
    return $head.StartsWith('<?php //0') -or $head.StartsWith('<?php //ICB')
}

function Assert-BandFileParity {
    # Assertion 1 (T031): the band's relative file set equals original/'s.
    # Tolerated by design: *.ocmod.xml only in original (the customer band is
    # stripped by Remove-OcmodSourceXmlFromBand) and *.ocmod.zip only in the
    # band (the T034 per-band installer zip on a re-run).
    param(
        [Parameter(Mandatory = $true)][string]$OriginalRoot,
        [Parameter(Mandatory = $true)][string]$BandRoot
    )
    $orig = Get-RelativeFileSet -Root $OriginalRoot
    $band = Get-RelativeFileSet -Root $BandRoot
    $problems = @()
    foreach ($key in $orig.Keys) {
        if (-not $band.ContainsKey($key) -and $key -notmatch '\.ocmod\.xml$') {
            $problems += "missing in band: $($orig[$key])"
        }
    }
    foreach ($key in $band.Keys) {
        if (-not $orig.ContainsKey($key) -and $key -notmatch '\.ocmod\.zip$') {
            $problems += "extra in band: $($band[$key])"
        }
    }
    if ($problems.Count -gt 0) {
        throw ("Encode assertion 1 (file parity) failed for ${BandRoot}:`n  " +
            (($problems | Sort-Object) -join "`n  "))
    }
}

function Assert-BandAssetParity {
    # 2026-08-25 review: every non-.php file (twig, app.js/app.css, fonts,
    # language assets ride the ionCube --copy path) must be byte-identical
    # to its original/ counterpart. Proven per band against original/, which
    # transitively proves band-vs-band identity of admin/view/** between the
    # PHP 7.2-7.4 and 7.4-8.3 bands.
    param(
        [Parameter(Mandatory = $true)][string]$OriginalRoot,
        [Parameter(Mandatory = $true)][string]$BandRoot
    )
    $problems = @()
    Get-ChildItem -Path $BandRoot -Recurse -File | Where-Object {
        $_.Extension -ne '.php' -and $_.Name -notmatch '\.ocmod\.zip$'
    } | ForEach-Object {
        $rel = $_.FullName.Substring($BandRoot.Length).TrimStart('\')
        $origFile = Join-Path $OriginalRoot $rel
        if (-not (Test-Path $origFile)) {
            # File-set parity is assertion 1's job; only compare what exists.
            return
        }
        if ((Get-FileSha256Hex -Path $origFile) -ne (Get-FileSha256Hex -Path $_.FullName)) {
            $problems += "copied asset differs from original: $rel"
        }
    }
    if ($problems.Count -gt 0) {
        throw ("Encode assertion 4 (asset byte-parity) failed for ${BandRoot}:`n  " +
            (($problems | Sort-Object) -join "`n  "))
    }
}

function Assert-BandEncoded {
    # Assertion 2 (T031): every effective encodePaths file in the band starts
    # with the ionCube stub and carries no build sentinel; every allowlist
    # file is byte-identical to its original counterpart (allowlist files are
    # never sentinel-injected, so a direct byte compare is valid).
    param(
        [Parameter(Mandatory = $true)]$Manifest,
        [Parameter(Mandatory = $true)][string]$OriginalRoot,
        [Parameter(Mandatory = $true)][string]$BandRoot,
        [string]$Sentinel
    )
    $problems = @()
    foreach ($rel in (Get-EffectiveEncodeRelativePaths -Manifest $Manifest -OriginalRoot $OriginalRoot)) {
        $bandFile = Join-Path $BandRoot $rel
        if (-not (Test-Path $bandFile)) {
            $problems += "protected file missing in band: $rel"
            continue
        }
        if (-not (Test-IonCubeStubFile -Path $bandFile)) {
            $problems += "protected file is not ionCube-encoded: $rel"
        }
        if ($Sentinel) {
            $content = [System.IO.File]::ReadAllText($bandFile)
            if ($content.Contains("NPP-SRC-$Sentinel")) {
                $problems += "build sentinel found in band file (plaintext source shipped): $rel"
            }
        }
    }
    foreach ($rel in (Get-PlaintextAllowlistRelativePaths -Manifest $Manifest)) {
        $origFile = Join-Path $OriginalRoot $rel
        if (-not (Test-Path $origFile)) {
            continue
        }
        $bandFile = Join-Path $BandRoot $rel
        if (-not (Test-Path $bandFile)) {
            $problems += "allowlist file missing in band: $rel"
            continue
        }
        if ((Get-FileSha256Hex -Path $origFile) -ne (Get-FileSha256Hex -Path $bandFile)) {
            $problems += "allowlist file differs from original: $rel"
        }
    }
    if ($problems.Count -gt 0) {
        throw ("Encode assertion 2 (encoding) failed for ${BandRoot}:`n  " +
            (($problems | Sort-Object) -join "`n  "))
    }
}

function Assert-BandEncodeClosure {
    # Assertion 3 (T032): the set of ionCube-stubbed .php files in the band
    # EQUALS the effective encodePaths, and every remaining band .php is on
    # the plaintext allowlist. A new .php the glob missed fails the build —
    # the silent-plaintext hole is closed.
    param(
        [Parameter(Mandatory = $true)]$Manifest,
        [Parameter(Mandatory = $true)][string]$OriginalRoot,
        [Parameter(Mandatory = $true)][string]$BandRoot
    )
    $encodeSet = @{}
    foreach ($rel in (Get-EffectiveEncodeRelativePaths -Manifest $Manifest -OriginalRoot $OriginalRoot)) {
        $encodeSet[$rel.ToLowerInvariant()] = $rel
    }
    $allowSet = @{}
    foreach ($rel in (Get-PlaintextAllowlistRelativePaths -Manifest $Manifest)) {
        $allowSet[$rel.ToLowerInvariant()] = $rel
    }
    $problems = @()
    $stubbed = @{}
    Get-ChildItem -Path $BandRoot -Recurse -File -Filter '*.php' | ForEach-Object {
        $rel = $_.FullName.Substring($BandRoot.Length).TrimStart('\')
        $key = $rel.ToLowerInvariant()
        if (Test-IonCubeStubFile -Path $_.FullName) {
            $stubbed[$key] = $rel
            if (-not $encodeSet.ContainsKey($key)) {
                $problems += "encoded file not listed in effective encodePaths: $rel"
            }
        }
        elseif (-not $allowSet.ContainsKey($key)) {
            $problems += "plaintext .php not on plaintextAllowlist: $rel"
        }
    }
    foreach ($key in @($encodeSet.Keys)) {
        if (-not $stubbed.ContainsKey($key)) {
            $problems += "effective encodePaths file not encoded in band: $($encodeSet[$key])"
        }
    }
    if ($problems.Count -gt 0) {
        throw ("Encode assertion 3 (closure) failed for ${BandRoot}:`n  " +
            (($problems | Sort-Object) -join "`n  "))
    }
}

function New-BandOcmodInstallerZip {
    # T034: per-band installer zip — the band's upload/ tree at the archive
    # root as a top-level 'upload/' folder with FORWARD-SLASH entry names,
    # built via .NET ZipArchive. Never Compress-Archive: PowerShell 5.1 writes
    # backslash entry names OpenCart's installer rejects.
    # Safety vs Remove-ObsoleteReleaseZips: that function enumerates *.zip at
    # the VERSION ROOT non-recursively (Get-ChildItem without -Recurse), so a
    # zip inside the band folder is out of its reach by construction.
    param(
        [Parameter(Mandatory = $true)][string]$BandRoot,
        [Parameter(Mandatory = $true)][string]$OcFolder,
        [Parameter(Mandatory = $true)][string]$ModuleName
    )
    $uploadRoot = Join-Path $BandRoot ($OcFolder + '\upload')
    if (-not (Test-Path $uploadRoot)) {
        throw "Band upload tree not found: $uploadRoot"
    }
    $zipPath = Join-Path (Join-Path $BandRoot $OcFolder) ($ModuleName + '.ocmod.zip')
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
    }
    Add-Type -AssemblyName System.IO.Compression | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
    $stream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::CreateNew)
    $zip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($f in @(Get-ChildItem -Path $uploadRoot -Recurse -File | Sort-Object FullName)) {
            $rel = $f.FullName.Substring($uploadRoot.Length).TrimStart('\')
            $entryName = 'upload/' + (($rel -split '\\') -join '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zip, $f.FullName, $entryName,
                [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    }
    finally {
        $zip.Dispose()
        $stream.Dispose()
    }
    Write-Host "Band installer zip: $zipPath"
    return $zipPath
}

function Set-LicenceProductionKey {
    # T039: build-time dev/prod licence public-key switch. The dev sandbox
    # embeds the DEV public key in `const PUBLIC_KEY = "..."` (its private
    # half is the gitignored package\tmp\npp-licence-dev-keys\ keypair). When
    # the manifest carries licence.productionPublicKeyFile (path relative to
    # package\), the STAGED upload copy gets that constant's value replaced
    # with the production PEM - the dev sandbox is never touched. Without the
    # manifest key the staged copy keeps the dev key and the build warns:
    # such a build must never ship to customers.
    param(
        [Parameter(Mandatory = $true)]
        $Manifest,
        [Parameter(Mandatory = $true)]
        [string]$UploadDest
    )

    $carriers = @(Get-ChildItem -Path $UploadDest -Recurse -File -Filter '*.php' |
        Where-Object { (Get-Content $_.FullName -Raw) -match 'const PUBLIC_KEY = "' })

    if (-not $carriers) { return }

    $keyFile = $null
    if (($Manifest.PSObject.Properties.Name -contains 'licence') -and $Manifest.licence -and
        ($Manifest.licence.PSObject.Properties.Name -contains 'productionPublicKeyFile') -and
        $Manifest.licence.productionPublicKeyFile) {
        $keyFile = Join-Path (Get-ReleasePackageRoot) $Manifest.licence.productionPublicKeyFile
        if (-not (Test-Path $keyFile)) {
            throw "licence.productionPublicKeyFile not found: $keyFile"
        }
    }

    if (-not $keyFile) {
        foreach ($f in $carriers) {
            Write-Warning ("Staged file still carries the DEV licence public key " +
                "(set manifest licence.productionPublicKeyFile before a customer release): " + $f.FullName)
        }
        return
    }

    $pem = Get-Content $keyFile -Raw
    if ($pem -notmatch 'BEGIN PUBLIC KEY') {
        throw "licence.productionPublicKeyFile is not a PEM public key: $keyFile"
    }
    $pem = ($pem -replace "`r`n", "`n").TrimEnd("`n") + "`n"
    $escaped = $pem -replace "`n", '\n'

    $pattern = '(const PUBLIC_KEY = ")[^"]*(";)'
    foreach ($f in $carriers) {
        $content = Get-Content $f.FullName -Raw
        $found = [regex]::Matches($content, $pattern)
        if ($found.Count -ne 1) {
            throw "Expected exactly one PUBLIC_KEY constant in $($f.FullName), found $($found.Count)"
        }
        $newContent = [regex]::Replace($content, $pattern, ('${1}' + $escaped + '${2}'))
        [System.IO.File]::WriteAllText($f.FullName, $newContent, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "Licence PUBLIC_KEY -> production key in staged copy: $($f.FullName)"
    }
}

function Invoke-ModuleBuild {
    param(
        [Parameter(Mandatory = $true)]
        $Manifest,
        [string]$Version
    )
    $versionFolder = Resolve-ReleaseVersion -Manifest $Manifest -VersionOverride $Version
    # T029: UI-workspace modules hard-fail here, before anything is copied,
    # when the deployed bundle is stale relative to the UI sources.
    Assert-UiBuildState -Manifest $Manifest
    $paths = Ensure-OcMaxVersionLayout -Manifest $Manifest -VersionFolder $versionFolder
    Invoke-ModuleInstructionBuild -Manifest $Manifest -Version $Version
    Sync-SharedExtraAssets -SourceRoot $paths.DevSandbox -DestRoot $paths.VersionRoot -Manifest $Manifest
    Sync-ReleaseRootDocs -Manifest $Manifest -VersionRoot $paths.VersionRoot
    $originalRoot = Join-Path $paths.VersionRoot 'original'

    Write-Host "Build version: $versionFolder (from oc3 controller)"
    $report = @()
    foreach ($entry in $Manifest.build.versions) {
        $sandboxRoot = Join-Path $paths.HomeRoot $entry.sandbox
        $ocFolder = Join-Path $originalRoot $entry.ocmaxFolder
        $uploadDest = Join-Path $ocFolder 'upload'
        $modDest = Join-Path $ocFolder 'modification'

        if (Test-Path $uploadDest) { Remove-Item $uploadDest -Recurse -Force }
        if (Test-Path $modDest) { Remove-Item $modDest -Recurse -Force }
        Ensure-Dir $uploadDest
        Ensure-Dir $modDest

        $uploadCount = 0
        $modCount = 0
        $key = $entry.key

        foreach ($rel in (Get-ManifestBuildUploadPaths -Manifest $Manifest -Key $key)) {
            Copy-Relative -SourceRoot $sandboxRoot -DestRoot $uploadDest -RelativePath $rel -Count ([ref]$uploadCount)
        }
        Copy-LangFilesForBuild -SandboxRoot $sandboxRoot -UploadDest $uploadDest `
            -Filters $Manifest.build.langFileFilters -Count ([ref]$uploadCount)

        # T039: dev -> production licence public key, staged copy only.
        Set-LicenceProductionKey -Manifest $Manifest -UploadDest $uploadDest

        if ($entry.modType -eq 'ocmod') {
            $createInstallerZips = $false
            if ($entry.PSObject.Properties.Name -contains 'ocmodInstallerZip') {
                $createInstallerZips = [bool]$entry.ocmodInstallerZip
            }
            Copy-OcmodMods -SandboxRoot $sandboxRoot -ModDest $modDest `
                -Glob $Manifest.build.modifiers.ocmodGlob -Count ([ref]$modCount) `
                -CreateInstallerZips:$createInstallerZips
        }
        else {
            Copy-VqmodMods -SandboxRoot $sandboxRoot -ModDest $modDest `
                -Glob $Manifest.build.modifiers.vqmodGlob `
                -StripTrailingUnderscore $Manifest.build.modifiers.vqmodStripTrailingUnderscore `
                -Count ([ref]$modCount)
        }

        $report += [PSCustomObject]@{
            Sandbox     = $entry.sandbox
            OcMaxFolder = $entry.ocmaxFolder
            UploadFiles = $uploadCount
            ModFiles    = $modCount
        }
        Write-Host "[$($entry.sandbox)] -> $($entry.ocmaxFolder): upload=$uploadCount modification=$modCount"
    }

    if (Test-ModuleUsesEncodeGlobs -Manifest $Manifest) {
        # T031 hook: sentinel goes into the ORIGINAL staging copy only — after
        # all upload/ copying, never into the dev sandbox.
        Add-EncodeSentinel -Manifest $Manifest -OriginalRoot $originalRoot | Out-Null
    }

    Write-Host ''
    Write-Host "Built module $($Manifest.module): $originalRoot"
    return [PSCustomObject]@{ VersionFolder = $versionFolder; Report = $report }
}

function Invoke-ModuleInstructionBuild {
    param(
        [Parameter(Mandatory = $true)]
        $Manifest,
        [string]$Version
    )
    # Sync-ReleaseRootDocs copies only Get-ReleaseRootFileNames, so without this
    # entry the instruction never reaches the version root or the release zip.
    # Checked by name, not on disk: a stale copy left in the version root would
    # otherwise pass.
    if ((Get-ReleaseRootFileNames -Manifest $Manifest) -notcontains 'instruction.html') {
        throw "releaseAssets.rootFiles in modules\$($Manifest.module)\manifest.json must list instruction.html"
    }
    $paths = Get-ReleasePaths -Manifest $Manifest
    $instructionBuilt = $false
    if (($Manifest.releaseAssets.PSObject.Properties.Name -contains 'instructionSource') -and
        $Manifest.releaseAssets.instructionSource) {
        $homeRoot = $Manifest.paths.homeRoot
        $devSandbox = $Manifest.paths.devSandbox
        $srcRel = $Manifest.releaseAssets.instructionSource -replace '/', '\'
        $prebuilt = Join-Path $homeRoot (Join-Path $devSandbox $srcRel)
        if (-not (Test-Path $prebuilt)) {
            throw "instructionSource not found: $prebuilt"
        }
        $destDocs = Join-Path $paths.DocsSource 'instruction.html'
        Ensure-Dir (Split-Path $destDocs -Parent)
        Copy-Item $prebuilt $destDocs -Force
        Write-Host "Instruction (prebuilt): $destDocs"
        $instructionBuilt = $true
    }
    if (-not $instructionBuilt) {
        $scriptPath = Join-Path (Get-ReleasePackageRoot) 'scripts\build-instruction.ps1'
        & $scriptPath -Module $Manifest.module -Version $Version | Out-Null
    }
    $versionFolder = if ($Version) { Format-OcMaxVersionFolder $Version } else { $null }
    if (-not $versionFolder) {
        $versionFolder = Resolve-ReleaseVersion -Manifest $Manifest
    }
    $versionPaths = Get-ReleasePaths -Manifest $Manifest -VersionFolder $versionFolder
    $src = Join-Path $paths.DocsSource 'instruction.html'
    if (-not (Test-Path $src)) {
        throw "Built instruction not found: $src"
    }
    Sync-ReleaseRootDocs -Manifest $Manifest -VersionRoot $versionPaths.VersionRoot
    foreach ($obsolete in $Manifest.releaseAssets.obsoleteRootFiles) {
        $old = Join-Path $versionPaths.VersionRoot $obsolete
        if (Test-Path $old) {
            Remove-Item $old -Force
            Write-Host "Removed obsolete: $old"
        }
    }
    Write-Host "Instruction: $(Join-Path $versionPaths.VersionRoot 'instruction.html')"
}

function Format-ReleaseZipVersion {
    param([string]$VersionFolder)
    if ($VersionFolder -match 'v\.\s*(.+)') {
        return 'v_' + $Matches[1].Trim()
    }
    return ($VersionFolder -replace '\s+', '_')
}

function Get-ReleaseZipPath {
    param(
        [string]$VersionRoot,
        $Manifest,
        [string]$VersionFolder
    )
    $zipVersion = Format-ReleaseZipVersion $VersionFolder
    $name = $Manifest.ioncube.zip.nameTemplate -replace '\{version\}', $zipVersion
    $name = $name -replace '\(\{band\}\)', '' -replace '\{band\}', ''
    return Join-Path $VersionRoot $name
}

function Remove-ObsoleteReleaseZips {
    param(
        [string]$VersionRoot,
        [string]$KeepZipPath
    )
    Get-ChildItem -Path $VersionRoot -Filter '*.zip' -File | Where-Object {
        $_.FullName -ne $KeepZipPath
    } | ForEach-Object {
        Remove-Item $_.FullName -Force
        Write-Host "Removed obsolete zip: $($_.Name)"
    }
}

function New-ReleaseModuleZip {
    # Customer module ZIP at version root — forward-slash entry names for Mac/unix
    # unzip tools. Never Compress-Archive: PowerShell 5.1 writes backslashes.
    param(
        [string]$VersionRoot,
        $Manifest,
        [string[]]$BandFolders,
        [string]$ZipPath
    )
    if (Test-Path $ZipPath) {
        Remove-Item $ZipPath -Force
    }
    $pathsToZip = [System.Collections.Generic.List[string]]::new()
    foreach ($bandFolder in $BandFolders) {
        $bandPath = Join-Path $VersionRoot $bandFolder
        if (-not (Test-Path $bandPath)) {
            throw "Band folder not found for zip: $bandPath"
        }
        $pathsToZip.Add($bandPath)
    }
    foreach ($file in (Get-ReleaseRootFileNames -Manifest $Manifest)) {
        $src = Join-Path $VersionRoot $file
        if (Test-Path $src) {
            $pathsToZip.Add($src)
        }
    }
    foreach ($dir in $Manifest.releaseAssets.rootDirs) {
        $srcDir = Join-Path $VersionRoot $dir
        if (Test-Path $srcDir) {
            $pathsToZip.Add($srcDir)
        }
    }
    if ($pathsToZip.Count -eq 0) {
        throw "Nothing to zip under: $VersionRoot"
    }
    Add-Type -AssemblyName System.IO.Compression | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
    $versionRootFull = (Resolve-Path $VersionRoot).Path.TrimEnd('\')
    $stream = [System.IO.File]::Open($ZipPath, [System.IO.FileMode]::CreateNew)
    $zip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($sourcePath in $pathsToZip) {
            if (-not (Test-Path -LiteralPath $sourcePath)) {
                continue
            }
            $sourceFull = (Resolve-Path -LiteralPath $sourcePath).Path
            $item = Get-Item -LiteralPath $sourceFull
            if ($item.PSIsContainer) {
                $prefix = $item.FullName.Substring($versionRootFull.Length).TrimStart('\')
                $prefix = (($prefix -split '\\') -join '/')
                foreach ($f in @(Get-ChildItem -LiteralPath $item.FullName -Recurse -File | Sort-Object FullName)) {
                    $rel = $f.FullName.Substring($item.FullName.Length).TrimStart('\')
                    $entryName = $prefix + '/' + (($rel -split '\\') -join '/')
                    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                        $zip, $f.FullName, $entryName,
                        [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
                }
            }
            else {
                $entryName = (($item.FullName.Substring($versionRootFull.Length).TrimStart('\') -split '\\') -join '/')
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                    $zip, $item.FullName, $entryName,
                    [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
            }
        }
    }
    finally {
        $zip.Dispose()
        $stream.Dispose()
    }
}

function Sync-EncodedCoreFiles {
    param(
        [string]$BandRoot,
        $Manifest
    )
    $sync = $Manifest.ioncube.syncEncodedPaths
    $sourceOc = 'OpenCart 3.X.X.X'
    $helperSrc = Join-Path $BandRoot ($sourceOc + '\' + $sync.helper)
    if (-not (Test-Path $helperSrc)) {
        throw "Encoded helper not found: $helperSrc"
    }
    foreach ($oc in $Manifest.ioncube.ocFolders) {
        $helperDst = Join-Path $BandRoot ($oc + '\' + $sync.helper)
        if ($helperDst -ne $helperSrc) {
            Ensure-Dir (Split-Path $helperDst -Parent)
            Copy-Item $helperSrc $helperDst -Force
        }
    }
    $ctrlSrc = Join-Path $BandRoot ($sourceOc + '\' + $sync.adminController.$sourceOc)
    if (-not (Test-Path $ctrlSrc)) {
        throw "Encoded admin controller not found: $ctrlSrc"
    }
    foreach ($oc in $Manifest.ioncube.ocFolders) {
        if ($oc -eq $sourceOc) { continue }
        $ctrlDst = Join-Path $BandRoot ($oc + '\' + $sync.adminController.$oc)
        Ensure-Dir (Split-Path $ctrlDst -Parent)
        Copy-Item $ctrlSrc $ctrlDst -Force
    }
}

function Get-IonCubeBandSteps {
    param($Band)
    if ($Band.PSObject.Properties.Name -contains 'steps' -and $Band.steps -and $Band.steps.Count -gt 0) {
        return @($Band.steps)
    }
    if ($Band.PSObject.Properties.Name -contains 'encoder' -and $Band.encoder) {
        return @([PSCustomObject]@{ encoder = $Band.encoder; mode = 'single' })
    }
    throw "ioncube band '$($Band.folder)' must define 'steps' or legacy 'encoder'"
}

function Resolve-IonCubeSourcePath {
    param(
        [string]$OriginalRoot,
        [string]$RelativePath
    )
    $full = Join-Path $OriginalRoot $RelativePath
    if (-not (Test-Path $full)) {
        throw "ionCube source path not found: $full"
    }
    return $full
}

function Get-IonCubeEncoderArgs {
    param(
        $Manifest,
        [string]$OriginalRoot,
        [string]$OutputRoot,
        [ValidateSet('single', 'bundle', 'add-to-bundle')]
        [string]$BundleMode = 'single',
        [string]$BundleDir
    )
    $ic = $Manifest.ioncube
    $args = [System.Collections.Generic.List[string]]::new()
    $args.Add('--exclude'); $args.Add('*.*')
    # T030: encodeGlobs (minus the plaintext allowlist) expand to individual
    # file paths; literal encodePaths remain the fallback for legacy modules.
    foreach ($path in (Get-EffectiveEncodeRelativePaths -Manifest $Manifest -OriginalRoot $OriginalRoot)) {
        $args.Add('--encode')
        $args.Add((Resolve-IonCubeSourcePath -OriginalRoot $OriginalRoot -RelativePath $path))
    }
    if ($BundleMode -ne 'add-to-bundle') {
        foreach ($oc in $ic.ocFolders) {
            foreach ($sub in $ic.copyUploadSubdirs) {
                $args.Add('--copy')
                $args.Add((Resolve-IonCubeSourcePath -OriginalRoot $OriginalRoot -RelativePath ($oc + '\upload\' + $sub)))
            }
            $args.Add('--copy')
            $args.Add((Resolve-IonCubeSourcePath -OriginalRoot $OriginalRoot -RelativePath ($oc + '\modification')))
        }
    }
    foreach ($flag in $ic.flags) {
        $args.Add($flag)
    }
    if ($BundleMode -eq 'bundle') {
        if (-not $BundleDir) {
            throw 'BundleDir is required when BundleMode is bundle'
        }
        $args.Add('--bundle'); $args.Add($BundleDir)
    }
    elseif ($BundleMode -eq 'add-to-bundle') {
        if (-not $BundleDir) {
            throw 'BundleDir is required when BundleMode is add-to-bundle'
        }
        $args.Add('--add-to-bundle'); $args.Add($BundleDir)
        $args.Add('--only-include-encoded-files')
    }
    $args.Add($OriginalRoot)
    $args.Add('-o'); $args.Add($OutputRoot)
    return $args.ToArray()
}

function Format-IonCubeCliArgument {
    param([string]$Value)
    if ($Value -match '[\s"]') {
        $escaped = $Value.Replace('"', '\"')
        if ($escaped.EndsWith('\')) {
            $escaped += '\'
        }
        return '"' + $escaped + '"'
    }
    return $Value
}

function Invoke-IonCubeEncoderCli {
    param(
        [string]$Exe,
        [string[]]$Arguments
    )
    $argLine = ($Arguments | ForEach-Object { Format-IonCubeCliArgument $_ }) -join ' '
    Write-Verbose "ionCube CLI: $Exe $argLine"
    & $Exe @Arguments
    if ($null -ne $LASTEXITCODE) {
        return [int]$LASTEXITCODE
    }
    return 0
}

function Invoke-ModuleEncode {
    param(
        [Parameter(Mandatory = $true)]
        $Manifest,
        [string]$Version
    )
    $versionFolder = Resolve-ReleaseVersion -Manifest $Manifest -VersionOverride $Version
    $paths = Get-ReleasePaths -Manifest $Manifest -VersionFolder $versionFolder
    $originalRoot = Join-Path $paths.VersionRoot 'original'
    if (-not (Test-Path $originalRoot)) {
        throw "original/ not found. Run build first: $originalRoot"
    }

    $ic = $Manifest.ioncube
    $encoderDir = $ic.encoderDir
    if (-not (Test-Path $encoderDir)) {
        throw "ionCube Encoder not found: $encoderDir"
    }

    $oc3InstallerZipFolder = Get-OcmodInstallerZipOcFolder -Manifest $Manifest
    $useEncodeGlobs = Test-ModuleUsesEncodeGlobs -Manifest $Manifest
    $buildSentinel = $null
    if ($useEncodeGlobs) {
        # T031: the sentinel hex is stamped by the build step (Add-EncodeSentinel);
        # the post-encode assertions need it to prove no plaintext source shipped.
        $encodeStatePath = Get-ModuleEncodeStatePath -Manifest $Manifest
        if (-not (Test-Path $encodeStatePath)) {
            throw "Encode state not found: $encodeStatePath - run the build step first (it injects the sentinel)."
        }
        $encodeState = Get-Content $encodeStatePath -Raw -Encoding UTF8 | ConvertFrom-Json
        $buildSentinel = [string]$encodeState.sentinel
        if (-not $buildSentinel) {
            throw "Encode state has no sentinel: $encodeStatePath - run the build step first."
        }
    }
    Sync-ReleaseRootDocs -Manifest $Manifest -VersionRoot $paths.VersionRoot
    Write-Host "Encode version: $versionFolder"
    $results = @()
    $bandFolderNames = [System.Collections.Generic.List[string]]::new()
    $bundleWorkRoot = Join-Path $paths.VersionRoot '.ioncube-bundle'
    if (Test-Path $bundleWorkRoot) {
        Remove-Item $bundleWorkRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Path $bundleWorkRoot -Force | Out-Null

    foreach ($band in $ic.bands) {
        $steps = Get-IonCubeBandSteps -Band $band
        $outRoot = Join-Path $paths.VersionRoot $band.folder
        if (Test-Path $outRoot) {
            Remove-Item $outRoot -Recurse -Force
        }

        $bundleId = if ($band.PSObject.Properties.Name -contains 'bundleId' -and $band.bundleId) {
            $band.bundleId
        } else {
            ($band.folder -replace '[^\w\-]', '-')
        }
        $bundleDir = Join-Path $bundleWorkRoot $bundleId
        if (Test-Path $bundleDir) {
            Remove-Item $bundleDir -Recurse -Force
        }
        New-Item -ItemType Directory -Path $bundleDir -Force | Out-Null

        # Encoder 13.0.2 (ioncube_encoder74.exe in particular) dies
        # PROBABILISTICALLY with 0xC0000374 (STATUS_HEAP_CORRUPTION,
        # -1073740940) once the --encode list grows past ~10 files - bisected
        # 2026-08-25 on the novaposhta_pro P1 set: any single file or pair
        # encodes fine, the same triple crashes 25-75% of runs regardless of
        # flags. The retry redoes the WHOLE band from a clean outRoot and
        # bundleDir (never a single step: a crashed add-to-bundle could leave
        # partial bundle state behind). Every other exit code fails fast, and
        # the band assertions below still gate the surviving tree.
        $heapCorruption = -1073740940
        $bandAttempts = 5
        $encodersUsed = [System.Collections.Generic.List[string]]::new()
        for ($bandTry = 1; $bandTry -le $bandAttempts; $bandTry++) {
            if ($bandTry -gt 1) {
                Write-Warning ("Encoder heap-corruption crash (0xC0000374); retrying band $($band.folder) from clean state, attempt ${bandTry}/${bandAttempts}")
                if (Test-Path $outRoot) {
                    Remove-Item $outRoot -Recurse -Force
                }
                if (Test-Path $bundleDir) {
                    Remove-Item $bundleDir -Recurse -Force
                }
                New-Item -ItemType Directory -Path $bundleDir -Force | Out-Null
                $encodersUsed.Clear()
            }
            $bandCrashed = $false
            $stepIndex = 0
            foreach ($step in $steps) {
                $stepIndex++
                $mode = if ($step.PSObject.Properties.Name -contains 'mode' -and $step.mode) {
                    $step.mode
                } else {
                    'single'
                }
                $encoderName = $step.encoder
                $exe = Join-Path $encoderDir $encoderName
                if (-not (Test-Path $exe)) {
                    throw "Encoder binary missing: $exe"
                }

                $encArgs = Get-IonCubeEncoderArgs -Manifest $Manifest -OriginalRoot $originalRoot `
                    -OutputRoot $outRoot -BundleMode $mode -BundleDir $bundleDir
                Write-Host "Encoding $($band.folder) step ${stepIndex}/$($steps.Count): $encoderName ($mode) ..."
                $exitCode = Invoke-IonCubeEncoderCli -Exe $exe -Arguments $encArgs
                if ($exitCode -eq $heapCorruption) {
                    $bandCrashed = $true
                    break
                }
                if ($exitCode -ne 0) {
                    throw "ionCube encoder failed ($encoderName, $mode) exit $exitCode"
                }
                $encodersUsed.Add($encoderName) | Out-Null
            }
            if (-not $bandCrashed) {
                break
            }
            if ($bandTry -eq $bandAttempts) {
                throw "ionCube encoder heap-corruption crash persisted through $bandAttempts attempts for band $($band.folder)"
            }
        }

        Sync-EncodedCoreFiles -BandRoot $outRoot -Manifest $Manifest
        Remove-OcmodSourceXmlFromBand -BandRoot $outRoot -OcFolder $oc3InstallerZipFolder
        if ($useEncodeGlobs) {
            # T031/T032: build-blocking assertions 1-3, then the T034 per-band
            # installer zip (created only after the band is proven clean).
            Assert-BandFileParity -OriginalRoot $originalRoot -BandRoot $outRoot
            Assert-BandEncoded -Manifest $Manifest -OriginalRoot $originalRoot `
                -BandRoot $outRoot -Sentinel $buildSentinel
            Assert-BandEncodeClosure -Manifest $Manifest -OriginalRoot $originalRoot -BandRoot $outRoot
            Assert-BandAssetParity -OriginalRoot $originalRoot -BandRoot $outRoot
            Write-Host "Encode assertions 1-4 passed: $($band.folder)"
            if ($oc3InstallerZipFolder) {
                New-BandOcmodInstallerZip -BandRoot $outRoot -OcFolder $oc3InstallerZipFolder `
                    -ModuleName $Manifest.module | Out-Null
            }
        }
        $bandFolderNames.Add($band.folder)
        $results += [PSCustomObject]@{
            Band     = $band.folder
            Output   = $outRoot
            Encoders = ($encodersUsed -join ' + ')
            Steps    = $steps.Count
        }
        Write-Host "Done: $outRoot ($($encodersUsed -join ' + '))"
    }

    $zipPath = Get-ReleaseZipPath -VersionRoot $paths.VersionRoot -Manifest $Manifest `
        -VersionFolder $versionFolder
    New-ReleaseModuleZip -VersionRoot $paths.VersionRoot -Manifest $Manifest `
        -BandFolders $bandFolderNames.ToArray() -ZipPath $zipPath
    Remove-ObsoleteReleaseZips -VersionRoot $paths.VersionRoot -KeepZipPath $zipPath
    Write-Host "Zip:  $zipPath"

    return [PSCustomObject]@{ VersionFolder = $versionFolder; Zip = $zipPath; Bands = $results }
}

function Get-RepoBranchConfig {
    param($Manifest)
    $dev = 'dev'
    $release = 'release'
    if ($Manifest.PSObject.Properties.Name -contains 'repo') {
        if ($Manifest.repo.devBranch) { $dev = $Manifest.repo.devBranch }
        if ($Manifest.repo.releaseBranch) { $release = $Manifest.repo.releaseBranch }
    }
    [PSCustomObject]@{ Dev = $dev; Release = $release }
}

function Get-RepoAssetPath {
    param(
        $Manifest,
        [Parameter(Mandatory = $true)]
        [string]$FileName
    )
    Join-Path (Get-ReleasePackageRoot) "modules\$($Manifest.module)\repo\$FileName"
}

function Remove-RepoPathIfExists {
    param(
        [string]$Root,
        [string]$Relative
    )
    if (-not $Relative) { return }
    $path = Join-Path $Root $Relative
    if (Test-Path $path) {
        Remove-Item $path -Recurse -Force
    }
}

function Clear-RepoForDevSync {
    param(
        [string]$RepoRoot,
        $Manifest
    )
    foreach ($dir in @('admin', 'catalog', 'system', 'docs', 'package', 'modification', 'original', 'extra')) {
        Remove-RepoPathIfExists -Root $RepoRoot -Relative $dir
    }
    foreach ($entry in $Manifest.build.versions) {
        Remove-RepoPathIfExists -Root $RepoRoot -Relative $entry.ocmaxFolder
    }
    foreach ($file in (Get-ReleaseRootFileNames -Manifest $Manifest)) {
        Remove-RepoPathIfExists -Root $RepoRoot -Relative $file
    }
    foreach ($band in @('PHP 5.6-7.4', 'PHP 7.4-8.3')) {
        Remove-RepoPathIfExists -Root $RepoRoot -Relative $band
    }
    Get-ChildItem -Path $RepoRoot -Filter '*.zip' -File -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue
}

function Clear-RepoForReleaseSync {
    param(
        [string]$RepoRoot,
        $Manifest
    )
    foreach ($dir in @('admin', 'catalog', 'system', 'docs', 'package', 'modification', 'original', 'extra', 'images')) {
        Remove-RepoPathIfExists -Root $RepoRoot -Relative $dir
    }
    foreach ($entry in $Manifest.build.versions) {
        Remove-RepoPathIfExists -Root $RepoRoot -Relative $entry.ocmaxFolder
    }
    foreach ($file in (Get-ReleaseRootFileNames -Manifest $Manifest)) {
        Remove-RepoPathIfExists -Root $RepoRoot -Relative $file
    }
    foreach ($band in @('PHP 5.6-7.4', 'PHP 7.4-8.3')) {
        Remove-RepoPathIfExists -Root $RepoRoot -Relative $band
    }
    Get-ChildItem -Path $RepoRoot -Filter (($Manifest.ioncube.zip.nameTemplate -replace '\{version\}', '*')) -File -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue
}

function Copy-RepoPackageTree {
    param(
        [string]$PackageRoot,
        [string]$RepoRoot,
        [string]$ModuleName
    )
    $destPackage = Join-Path $RepoRoot 'package'
    if (Test-Path $destPackage) { Remove-Item $destPackage -Recurse -Force }
    New-Item -ItemType Directory -Path $destPackage -Force | Out-Null

    Copy-Item (Join-Path $PackageRoot 'scripts') (Join-Path $destPackage 'scripts') -Recurse -Force
    Copy-Item (Join-Path $PackageRoot 'lib') (Join-Path $destPackage 'lib') -Recurse -Force
    New-Item -ItemType Directory -Path (Join-Path $destPackage 'modules') -Force | Out-Null
    Copy-Item (Join-Path $PackageRoot "modules\$ModuleName") (Join-Path $destPackage "modules\$ModuleName") -Recurse -Force
    if (Test-Path (Join-Path $PackageRoot 'README.md')) {
        Copy-Item (Join-Path $PackageRoot 'README.md') (Join-Path $destPackage 'README.md') -Force
    }
    if (Test-Path (Join-Path $PackageRoot 'modules\README.md')) {
        Copy-Item (Join-Path $PackageRoot 'modules\README.md') (Join-Path $destPackage 'modules\README.md') -Force
    }

    # Lint gate (variant A): committed PHAR + PHPStan/CS-Fixer configs on REPO dev
    $lintDirs = @('bin', 'phpstan', 'qa')
    foreach ($dir in $lintDirs) {
        $src = Join-Path $PackageRoot $dir
        if (-not (Test-Path $src)) { continue }
        $dest = Join-Path $destPackage $dir
        Copy-Item $src $dest -Recurse -Force
        # Ephemeral / local-only under qa
        $reports = Join-Path $dest 'reports'
        if (Test-Path $reports) { Remove-Item $reports -Recurse -Force -ErrorAction SilentlyContinue }
    }
    foreach ($file in @(
        'phpstan.neon',
        'phpstan-baseline.neon',
        'php-cs-fixer.extension.php',
        '.php-cs-fixer.dist.php',
        'composer.json',
        'composer.lock'
    )) {
        $src = Join-Path $PackageRoot $file
        if (Test-Path $src) {
            Copy-Item $src (Join-Path $destPackage $file) -Force
        }
    }
}

function Get-RepoDevDocsPlan {
    param(
        $Manifest,
        [string]$DevSandboxRoot
    )
    $directories = @(
        'docs\ukrposhta',
        'docs\shippingdata',
        'docs\ocmax-license',
        'docs\instruction'
    )
    $files = @(
        'docs\dev-environment.md',
        'docs\multi-version.md'
    )
    if ($Manifest.PSObject.Properties.Name -contains 'repo' -and $Manifest.repo.devDocs) {
        $cfg = $Manifest.repo.devDocs
        if ($cfg.directories) { $directories = @($cfg.directories) }
        if ($cfg.files) { $files = @($cfg.files) }
    }
    [PSCustomObject]@{
        Directories = $directories
        Files       = $files
    }
}

function Sync-RepoDevDocs {
    param(
        $Manifest,
        [string]$DevSandboxRoot,
        [string]$RepoRoot,
        [ref]$FileCount
    )
    $plan = Get-RepoDevDocsPlan -Manifest $Manifest -DevSandboxRoot $DevSandboxRoot
    $docsRoot = Join-Path $RepoRoot 'docs'
    if (Test-Path $docsRoot) {
        Remove-Item $docsRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Path $docsRoot -Force | Out-Null

    foreach ($relDir in $plan.Directories) {
        $src = Join-Path $DevSandboxRoot ($relDir -replace '/', '\')
        if (-not (Test-Path $src)) {
            Write-Warning "Dev docs directory missing: $src"
            continue
        }
        $leaf = ($relDir -replace '^docs[\\/]', '') -replace '/', '\'
        $dest = Join-Path $docsRoot $leaf
        Copy-Item $src $dest -Recurse -Force
        Get-ChildItem -Path $dest -Recurse -File | ForEach-Object { $FileCount.Value++ }
        Write-Host "  docs/$($leaf -replace '\\', '/')/  from $src"
    }

    foreach ($relFile in $plan.Files) {
        $normalized = $relFile -replace '/', '\'
        Copy-Relative -SourceRoot $DevSandboxRoot -DestRoot $RepoRoot -RelativePath $normalized -Count $FileCount
        Write-Host "  $normalized  from $(Join-Path $DevSandboxRoot $normalized)"
    }

    $readmeSrc = Get-RepoAssetPath -Manifest $Manifest -FileName 'docs-README.md'
    if (Test-Path $readmeSrc) {
        Copy-Item $readmeSrc (Join-Path $docsRoot 'README.md') -Force
        $FileCount.Value++
    }
}

function Copy-OcmodModsToSystem {
    param(
        [string]$SandboxRoot,
        [string]$RepoRoot,
        [string]$Glob,
        [ref]$Count
    )
    $srcDir = Join-Path $SandboxRoot 'system'
    $destDir = Join-Path $RepoRoot 'system'
    Ensure-Dir $destDir
    Get-ChildItem -Path $srcDir -Filter $Glob -File -ErrorAction SilentlyContinue | ForEach-Object {
        Copy-Item $_.FullName -Destination (Join-Path $destDir $_.Name) -Force
        $Count.Value++
    }
}

function Invoke-ModulePublishDev {
    param(
        [Parameter(Mandatory = $true)]
        $Manifest
    )
    $paths = Get-ReleasePaths -Manifest $Manifest
    $repoRoot = $paths.RepoRoot
    $branches = Get-RepoBranchConfig -Manifest $Manifest

    Clear-RepoForDevSync -RepoRoot $repoRoot -Manifest $Manifest

    $fileCount = 0
    foreach ($rel in $Manifest.build.upload.oc3) {
        Copy-Relative -SourceRoot $paths.DevSandbox -DestRoot $repoRoot -RelativePath $rel -Count ([ref]$fileCount)
    }
    Copy-LangFilesForBuild -SandboxRoot $paths.DevSandbox -UploadDest $repoRoot `
        -Filters $Manifest.build.langFileFilters -Count ([ref]$fileCount)
    Copy-OcmodModsToSystem -SandboxRoot $paths.DevSandbox -RepoRoot $repoRoot `
        -Glob $Manifest.build.modifiers.ocmodGlob -Count ([ref]$fileCount)

    Sync-RepoDevDocs -Manifest $Manifest -DevSandboxRoot $paths.DevSandbox -RepoRoot $repoRoot -FileCount ([ref]$fileCount)

    Copy-RepoPackageTree -PackageRoot $paths.PackageRoot -RepoRoot $repoRoot -ModuleName $Manifest.module

    $gitignoreSrc = Get-RepoAssetPath -Manifest $Manifest -FileName 'gitignore'
    if (Test-Path $gitignoreSrc) {
        Copy-Item $gitignoreSrc (Join-Path $repoRoot '.gitignore') -Force
    }
    $readmeSrc = Get-RepoAssetPath -Manifest $Manifest -FileName 'README.dev.md'
    if (Test-Path $readmeSrc) {
        Copy-Item $readmeSrc (Join-Path $repoRoot 'README.md') -Force
    }

    Write-Host "Published DEV branch content ($($branches.Dev)) for $($Manifest.module) -> $repoRoot"
    Write-Host "  admin/, catalog/, system/  from $($paths.DevSandbox)"
    Write-Host "  docs/  module + shared (see manifest.repo.devDocs)"
    Write-Host "  package/  tooling + manifest"
    Write-Host "  files copied: $fileCount"

    return [PSCustomObject]@{
        Branch    = $branches.Dev
        RepoRoot  = $repoRoot
        FileCount = $fileCount
    }
}

function Invoke-ModulePublishRelease {
    param(
        [Parameter(Mandatory = $true)]
        $Manifest,
        [string]$Version
    )
    $versionFolder = Resolve-ReleaseVersion -Manifest $Manifest -VersionOverride $Version
    $paths = Get-ReleasePaths -Manifest $Manifest -VersionFolder $versionFolder
    $repoRoot = $paths.RepoRoot
    $branches = Get-RepoBranchConfig -Manifest $Manifest
    $originalSource = Join-Path $paths.VersionRoot 'original'
    if (-not (Test-Path $originalSource)) {
        throw "Built original not found: $originalSource. Run build first."
    }

    Clear-RepoForReleaseSync -RepoRoot $repoRoot -Manifest $Manifest

    $folderCount = 0
    foreach ($entry in $Manifest.build.versions) {
        $src = Join-Path $originalSource $entry.ocmaxFolder
        if (-not (Test-Path $src)) {
            Write-Warning "Missing OCMax folder: $src"
            continue
        }
        $dest = Join-Path $repoRoot $entry.ocmaxFolder
        Copy-Item $src $dest -Recurse -Force
        $folderCount++
    }

    $extraSrc = Join-Path $paths.VersionRoot 'extra'
    if (Test-Path $extraSrc) {
        Copy-Item $extraSrc (Join-Path $repoRoot 'extra') -Recurse -Force
    }

    foreach ($file in (Get-ReleaseRootFileNames -Manifest $Manifest)) {
        $src = Join-Path $paths.VersionRoot $file
        if (Test-Path $src) {
            Copy-Item $src (Join-Path $repoRoot $file) -Force
        }
    }

    $screenshotPaths = Get-ModuleScreenshotPaths -Manifest $Manifest
    if (Test-Path $screenshotPaths.OutputDir) {
        Copy-Item $screenshotPaths.OutputDir (Join-Path $repoRoot 'images') -Recurse -Force
        Write-Host "  images/  from $($screenshotPaths.OutputDir)"
    }
    else {
        Write-Warning "Instruction images not found: $($screenshotPaths.OutputDir)"
    }

    foreach ($band in @('PHP 5.6-7.4', 'PHP 7.4-8.3')) {
        $bandSrc = Join-Path $paths.VersionRoot $band
        if (Test-Path $bandSrc) {
            Copy-Item $bandSrc (Join-Path $repoRoot $band) -Recurse -Force
        }
        else {
            Write-Warning "PHP band not found (run encode first): $bandSrc"
        }
    }

    $gitignoreSrc = Get-RepoAssetPath -Manifest $Manifest -FileName 'gitignore'
    if (Test-Path $gitignoreSrc) {
        Copy-Item $gitignoreSrc (Join-Path $repoRoot '.gitignore') -Force
    }
    $readmeSrc = Get-RepoAssetPath -Manifest $Manifest -FileName 'README.release.md'
    if (Test-Path $readmeSrc) {
        Copy-Item $readmeSrc (Join-Path $repoRoot 'README.md') -Force
    }

    Write-Host "Published RELEASE branch content ($($branches.Release)) for $($Manifest.module) -> $repoRoot"
    Write-Host "  version: $versionFolder"
    Write-Host "  OpenCart folders: $folderCount (from $originalSource)"
    Write-Host "  extra/, images/, root docs (instruction + licence), PHP bands (module ZIP excluded from git)"

    return [PSCustomObject]@{
        Branch        = $branches.Release
        RepoRoot      = $repoRoot
        VersionFolder = $versionFolder
        OcFolders     = $folderCount
    }
}

function Invoke-ModulePublish {
    param(
        [Parameter(Mandatory = $true)]
        $Manifest,
        [string]$Version,
        [ValidateSet('Dev', 'Release')]
        [string]$Target = 'Release'
    )
    switch ($Target) {
        'Dev' { return Invoke-ModulePublishDev -Manifest $Manifest }
        'Release' { return Invoke-ModulePublishRelease -Manifest $Manifest -Version $Version }
    }
}

function Invoke-ModuleReleaseAll {
    param(
        [Parameter(Mandatory = $true)]
        $Manifest,
        [string]$Version,
        [ValidateSet('changed', 'full')]
        [string]$Templates = 'changed',
        [switch]$SkipPropagate,
        [switch]$SkipEncode,
        [switch]$SkipPublish
    )
    $steps = [System.Collections.Generic.List[string]]::new()
    if (-not $SkipPropagate) { $steps.Add('propagate') }
    $steps.Add('build')
    if (-not $SkipEncode) { $steps.Add('encode') }
    if (-not $SkipPublish) { $steps.Add('publish') }

    $versionFolder = Resolve-ReleaseVersion -Manifest $Manifest -VersionOverride $Version
    $paths = Get-ReleasePaths -Manifest $Manifest -VersionFolder $versionFolder
    $report = [ordered]@{
        VersionFolder = $versionFolder
        Steps         = @()
        Skipped       = @()
    }
    if ($SkipPropagate) { $report.Skipped += 'propagate' }
    if ($SkipEncode) { $report.Skipped += 'encode' }
    if ($SkipPublish) { $report.Skipped += 'publish' }

    Write-Host "Release ALL: $($Manifest.module) -> $versionFolder"
    if ($report.Skipped.Count) {
        Write-Host "Skipped: $($report.Skipped -join ', ')"
    }
    Write-Host ''

    $index = 1
    $total = $steps.Count

    foreach ($step in $steps) {
        Write-Host "[$index/$total] $step"
        switch ($step) {
            'propagate' {
                $result = Invoke-ModulePropagate -Manifest $Manifest -Templates $Templates
                $report.Steps += [PSCustomObject]@{ Step = 'propagate'; Status = 'ok'; Result = $result }
            }
            'build' {
                $result = Invoke-ModuleBuild -Manifest $Manifest -Version $Version
                $versionFolder = $result.VersionFolder
                $report.VersionFolder = $versionFolder
                $report.Steps += [PSCustomObject]@{ Step = 'build'; Status = 'ok'; Result = $result }
            }
            'encode' {
                $result = Invoke-ModuleEncode -Manifest $Manifest -Version $versionFolder
                $report.Steps += [PSCustomObject]@{ Step = 'encode'; Status = 'ok'; Result = $result }
            }
            'publish' {
                $paths = Get-ReleasePaths -Manifest $Manifest -VersionFolder $versionFolder
                Invoke-ModulePublish -Manifest $Manifest -Version $versionFolder -Target Release
                $report.Steps += [PSCustomObject]@{ Step = 'publish'; Status = 'ok'; Repo = $paths.RepoRoot; Branch = 'release' }
            }
        }
        Write-Host ''
        $index++
    }

    Write-Host "Release ALL done: $versionFolder"
    return [PSCustomObject]$report
}
