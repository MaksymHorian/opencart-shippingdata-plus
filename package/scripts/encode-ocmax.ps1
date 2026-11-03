# ionCube encode OCMax customer bands from original/ (module manifest).
# Usage: .\encode-ocmax.ps1 -Module ukrposhta [-Version "v. 2.3.1"]

param(
    [Parameter(Mandatory = $true)]
    [string]$Module,
    [string]$Version
)

$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'lib\ReleaseModule.ps1')

$manifest = Import-ReleaseManifest -Module $Module
Invoke-ModuleEncode -Manifest $manifest -Version $Version
