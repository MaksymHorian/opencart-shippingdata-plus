# Split file to base64 chunks for browser Runtime.evaluate upload
param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Prefix,
    [int]$ChunkSize = 70000
)
$dir = Join-Path $env:TEMP "oc3-browser-upload"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Get-ChildItem "$dir\$Prefix-*" -ErrorAction SilentlyContinue | Remove-Item -Force
if (-not (Test-Path $Path)) { throw "File not found: $Path" }
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($Path))
$i = 0
for ($p = 0; $p -lt $b64.Length; $p += $ChunkSize) {
    $len = [Math]::Min($ChunkSize, $b64.Length - $p)
    $chunk = $b64.Substring($p, $len)
    Set-Content -NoNewline -Encoding ascii (Join-Path $dir "$Prefix-$i.txt") $chunk
    $i++
}
[PSCustomObject]@{
    path     = $Path
    name     = [IO.Path]::GetFileName($Path)
    prefix   = $Prefix
    chunks   = $i
    b64Len   = $b64.Length
    chunkDir = $dir
} | ConvertTo-Json -Compress
