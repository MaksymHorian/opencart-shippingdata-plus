# Full release pipeline: propagate -> build -> encode -> publish (sequential).
# MANUAL/CI FALLBACK ONLY — Cursor agents orchestrate via release-engineer + re-git + re-ioncube-encoder (see .cursor/agents/release-engineer.md).
# Usage: .\release-all.ps1 -Module ukrposhta [-SkipPropagate] [-SkipEncode] [-SkipPublish]

param(
    [Parameter(Mandatory = $true)]
    [string]$Module,
    [string]$Version,
    [ValidateSet('changed', 'full')]
    [string]$Templates = 'changed',
    [switch]$SkipPropagate,
    [switch]$SkipEncode,
    [switch]$SkipPublish
)

$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'lib\ReleaseModule.ps1')

$manifest = Import-ReleaseManifest -Module $Module
$report = Invoke-ModuleReleaseAll -Manifest $manifest -Version $Version -Templates $Templates `
    -SkipPropagate:$SkipPropagate -SkipEncode:$SkipEncode -SkipPublish:$SkipPublish

if (-not $SkipPublish) {
    Write-Host ''
    Write-Host 'Next: release-engineer delegates re-git (checkout release → commit → tag → push)'
}

return $report
