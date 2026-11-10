# Normalize the existing brand asset for browser installation; keep icon.png intact.
Add-Type -AssemblyName System.Drawing
$assetRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\public'))
$sourceIcon = [System.Drawing.Image]::FromFile((Join-Path $assetRoot 'icon.png'))
try {
    foreach ($iconSize in @(180, 192, 512)) {
        $bitmap = New-Object System.Drawing.Bitmap($iconSize, $iconSize)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([System.Drawing.Color]::White)
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $fitRatio = [Math]::Min(($iconSize * 0.8) / $sourceIcon.Width, ($iconSize * 0.8) / $sourceIcon.Height)
            $drawWidth = [int][Math]::Round($sourceIcon.Width * $fitRatio)
            $drawHeight = [int][Math]::Round($sourceIcon.Height * $fitRatio)
            $graphics.DrawImage($sourceIcon, [int](($iconSize - $drawWidth) / 2), [int](($iconSize - $drawHeight) / 2), $drawWidth, $drawHeight)
            $bitmap.Save((Join-Path $assetRoot "pwa-icon-$iconSize.png"), [System.Drawing.Imaging.ImageFormat]::Png)
        } finally { $graphics.Dispose(); $bitmap.Dispose() }
    }
} finally { $sourceIcon.Dispose() }
