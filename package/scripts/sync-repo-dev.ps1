# Publish OC3 dev source to git module repo (dev branch content).
# Usage: .\sync-repo-dev.ps1 -Module ukrposhta
# Git checkout/commit/push: release-engineer delegates re-git on branch dev.

param(
    [Parameter(Mandatory = $true)]
    [string]$Module
)

$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'lib\ReleaseModule.ps1')

$manifest = Import-ReleaseManifest -Module $Module
$result = Invoke-ModulePublish -Manifest $manifest -Target Dev

Write-Host ''
Write-Host "Next: re-git checkout dev -> commit -> push (via /release sync-dev)"

return $result
