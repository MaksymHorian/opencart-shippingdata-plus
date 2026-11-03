# UI build-state helpers shared by scripts/build-ui.ps1 and lib/ReleaseModule.ps1
# (Assert-UiBuildState). PowerShell 5.1-safe. Feature 004 T028/T029.
#
# The build state file package/modules/<module>/.ui-build-state.json records what
# the last UI build saw (source hash) and produced (per-dist-file hashes) so the
# release build can hard-fail on a stale or tampered bundle.

function Get-UiWorkspaceRoot {
    param(
        [Parameter(Mandatory = $true)][string]$PackageRoot,
        [Parameter(Mandatory = $true)][string]$Module
    )
    return Join-Path $PackageRoot "ui\$Module"
}

function Get-UiBuildStatePath {
    param(
        [Parameter(Mandatory = $true)][string]$PackageRoot,
        [Parameter(Mandatory = $true)][string]$Module
    )
    return Join-Path $PackageRoot "modules\$Module\.ui-build-state.json"
}

function Get-UiDistDir {
    # The manifest's dev sandbox is where Vite writes the bundle
    # (admin/view/javascript/<module> inside homeRoot\devSandbox).
    param(
        [Parameter(Mandatory = $true)]$Manifest
    )
    $sandboxRoot = Join-Path $Manifest.paths.homeRoot $Manifest.paths.devSandbox
    return Join-Path $sandboxRoot "admin\view\javascript\$($Manifest.module)"
}

function Get-FileSha256Hex {
    param([Parameter(Mandatory = $true)][string]$Path)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.IO.File]::ReadAllBytes($Path)
        return ([BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-', '').ToLower()
    }
    finally {
        $sha.Dispose()
    }
}

function Get-StringSha256Hex {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
        return ([BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-', '').ToLower()
    }
    finally {
        $sha.Dispose()
    }
}

function Get-UiSourceFileList {
    # Everything that determines the bundle: src/** plus the lockfile, the
    # three build configs and package.json (its "build" script shapes the
    # bundle - adding e.g. --sourcemap must trip the stale-bundle gate).
    # Returns objects { Rel; Full } with forward-slash Rel.
    param([Parameter(Mandatory = $true)][string]$WorkspaceRoot)
    $items = New-Object System.Collections.Generic.List[object]
    $srcRoot = Join-Path $WorkspaceRoot 'src'
    if (Test-Path $srcRoot) {
        Get-ChildItem -Path $srcRoot -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($WorkspaceRoot.Length).TrimStart('\') -replace '\\', '/'
            $items.Add([PSCustomObject]@{ Rel = $rel; Full = $_.FullName })
        }
    }
    foreach ($name in @('package.json', 'package-lock.json', 'vite.config.js', 'vite.config.mjs', 'tailwind.config.js', 'postcss.config.js')) {
        $full = Join-Path $WorkspaceRoot $name
        if (Test-Path $full) {
            $items.Add([PSCustomObject]@{ Rel = $name; Full = $full })
        }
    }
    return @($items | Sort-Object -Property @{ Expression = { $_.Rel.ToLowerInvariant() } })
}

function Get-UiSourceHash {
    # SHA256 over the sorted "relative-path|content-hash" lines of every UI
    # source input. Must stay byte-for-byte identical between build-ui.ps1
    # (which stamps it) and Assert-UiBuildState (which recomputes it).
    param([Parameter(Mandatory = $true)][string]$WorkspaceRoot)
    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($item in (Get-UiSourceFileList -WorkspaceRoot $WorkspaceRoot)) {
        $lines.Add($item.Rel + '|' + (Get-FileSha256Hex -Path $item.Full))
    }
    return Get-StringSha256Hex -Text (($lines.ToArray()) -join "`n")
}

function Get-UiDistHashes {
    # Ordered map of forward-slash relative path -> sha256 for every file in
    # the deployed dist dir (app.js, app.css, fonts/*).
    param([Parameter(Mandatory = $true)][string]$DistDir)
    $map = [ordered]@{}
    if (-not (Test-Path $DistDir)) {
        return $map
    }
    $files = @(Get-ChildItem -Path $DistDir -Recurse -File |
        Sort-Object -Property @{ Expression = { $_.FullName.ToLowerInvariant() } })
    foreach ($f in $files) {
        $rel = $f.FullName.Substring($DistDir.Length).TrimStart('\') -replace '\\', '/'
        $map[$rel] = Get-FileSha256Hex -Path $f.FullName
    }
    return $map
}
