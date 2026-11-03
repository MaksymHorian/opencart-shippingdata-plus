# Publish built OCMax release to git module repo (release branch content).
# Usage: .\publish-repo.ps1 -Module ukrposhta [-Version "v. 2.3.1"]
# Git checkout/commit/tag/push: release-engineer delegates re-git on branch release.

param(
    [Parameter(Mandatory = $true)]
    [string]$Module,
    [string]$Version
)

$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'lib\ReleaseModule.ps1')

$manifest = Import-ReleaseManifest -Module $Module
$result = Invoke-ModulePublish -Manifest $manifest -Version $Version -Target Release

Write-Host ''
Write-Host 'Next: re-git checkout release -> commit -> tag -> push (via /release publish)'

return $result
