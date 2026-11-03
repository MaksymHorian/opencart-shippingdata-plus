# Build OCMax customer package from per-version sandboxes (module manifest).
# Usage: .\build-ocmax.ps1 -Module ukrposhta [-Version "v. 2.3.1"]

param(
    [Parameter(Mandatory = $true)]
    [string]$Module,
    [string]$Version
)

$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'lib\ReleaseModule.ps1')

$manifest = Import-ReleaseManifest -Module $Module
Invoke-ModuleBuild -Manifest $manifest -Version $Version
