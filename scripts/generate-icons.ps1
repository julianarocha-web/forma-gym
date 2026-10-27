# Rebuild the geometric SVG monogram as supersampled PNGs and a multi-size ICO.
# Uses Windows System.Drawing only; no runtime or npm dependency.
Add-Type -AssemblyName System.Drawing
$outputDir = Join-Path $PSScriptRoot '../public'
function New-FormaIcon([int]$size, [bool]$maskable = $false) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#5735a8'))
  $graphics.ScaleTransform($size / 512.0, $size / 512.0)
  # All foreground points fit inside the central radius-204.8 safe circle.
  if ($maskable) {
    $graphics.TranslateTransform(256, 256)
    $graphics.ScaleTransform(0.8, 0.8)
    $graphics.TranslateTransform(-256, -256)
  }
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $points = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(144,120), [System.Drawing.PointF]::new(368,120),
    [System.Drawing.PointF]::new(368,184), [System.Drawing.PointF]::new(216,184),
    [System.Drawing.PointF]::new(216,248), [System.Drawing.PointF]::new(336,248),
    [System.Drawing.PointF]::new(336,312), [System.Drawing.PointF]::new(216,312),
    [System.Drawing.PointF]::new(216,392), [System.Drawing.PointF]::new(144,392)
  )
  $path.AddPolygon($points)
  $graphics.FillPath([System.Drawing.Brushes]::White, $path)
  $graphics.FillEllipse([System.Drawing.Brushes]::White, 320, 328, 64, 64)
  $path.Dispose()
  $graphics.Dispose()
  return $bitmap
}
function Get-IconPng([int]$size, [bool]$maskable = $false) {
  $large = New-FormaIcon ($size * 4) $maskable
  $small = [System.Drawing.Bitmap]::new($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($small)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($large, 0, 0, $size, $size)
  $stream = [System.IO.MemoryStream]::new()
  $small.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $stream.ToArray()
  $g.Dispose(); $large.Dispose(); $small.Dispose(); $stream.Dispose()
  return ,$bytes
}
foreach ($size in @(192, 512)) {
  [System.IO.File]::WriteAllBytes((Join-Path $outputDir "icon-$size.png"), (Get-IconPng $size))
}
[System.IO.File]::WriteAllBytes((Join-Path $outputDir 'apple-touch-icon.png'), (Get-IconPng 180))
[System.IO.File]::WriteAllBytes((Join-Path $outputDir 'icon-maskable-512.png'), (Get-IconPng 512 $true))
$sizes = @(16, 32, 48)
$images = @($sizes | ForEach-Object { ,(Get-IconPng $_) })
$ico = [System.IO.MemoryStream]::new()
$writer = [System.IO.BinaryWriter]::new($ico)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]3)
$offset = 6 + 16 * 3
for ($i = 0; $i -lt 3; $i++) {
  $writer.Write([byte]$sizes[$i]); $writer.Write([byte]$sizes[$i])
  $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([uint16]1); $writer.Write([uint16]32)
  $writer.Write([uint32]$images[$i].Length); $writer.Write([uint32]$offset)
  $offset += $images[$i].Length
}
foreach ($bytes in $images) { $writer.Write([byte[]]$bytes) }
[System.IO.File]::WriteAllBytes((Join-Path $outputDir 'favicon.ico'), $ico.ToArray())
$writer.Dispose(); $ico.Dispose()
