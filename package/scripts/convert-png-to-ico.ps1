param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    [int]$Size = 48
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $InputPath)) {
    Write-Error "Input not found: $InputPath"
}

if (-not ([System.Management.Automation.PSTypeName]'OcmaxIcoWriter').Type) {
    Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class OcmaxIcoWriter
{
    public static void WriteFromPng(string inputPath, string outputPath, int size)
    {
        using (var src = Image.FromFile(inputPath))
        using (var bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(bmp))
        {
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.Clear(Color.Transparent);
            g.DrawImage(src, 0, 0, size, size);

            byte[] pngBytes;
            using (var ms = new MemoryStream())
            {
                bmp.Save(ms, ImageFormat.Png);
                pngBytes = ms.ToArray();
            }

            using (var fs = File.Create(outputPath))
            using (var bw = new BinaryWriter(fs))
            {
                bw.Write((short)0);
                bw.Write((short)1);
                bw.Write((short)1);

                bw.Write((byte)size);
                bw.Write((byte)size);
                bw.Write((byte)0);
                bw.Write((byte)0);
                bw.Write((short)1);
                bw.Write((short)32);
                bw.Write((int)pngBytes.Length);
                bw.Write((int)22);

                bw.Write(pngBytes);
            }
        }
    }
}
'@ -ReferencedAssemblies System.Drawing
}

$dir = Split-Path -Parent $OutputPath
if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

[OcmaxIcoWriter]::WriteFromPng($InputPath, $OutputPath, $Size)
Write-Output "Wrote $OutputPath (${Size}x${Size}) from $InputPath"
