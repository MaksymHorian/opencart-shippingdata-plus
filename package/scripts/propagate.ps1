# Propagate module PHP + language + changed templates from dev sandbox to legacy sandboxes.
# Usage: .\propagate.ps1 -Module ukrposhta [-Templates changed|full]

param(
    [Parameter(Mandatory = $true)]
    [string]$Module,
    [ValidateSet('changed', 'full')]
    [string]$Templates = 'changed'
)

$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'lib\ReleaseModule.ps1')

$manifest = Import-ReleaseManifest -Module $Module
Invoke-ModulePropagate -Manifest $manifest -Templates $Templates
