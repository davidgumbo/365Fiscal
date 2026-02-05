param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [int]$AlphaThreshold = 10
)

Add-Type -AssemblyName System.Drawing

if (!(Test-Path $InputPath)) {
  Write-Error "Input file not found: $InputPath"; exit 1
}

$bmp = [System.Drawing.Bitmap]::FromFile($InputPath)
try {
  $minX = $bmp.Width
  $minY = $bmp.Height
  $maxX = -1
  $maxY = -1

  for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      $c = $bmp.GetPixel($x, $y)
      if ($c.A -gt $AlphaThreshold) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  if ($maxX -lt 0 -or $maxY -lt 0) {
    # fully transparent; just copy
    Copy-Item -Path $InputPath -Destination $OutputPath -Force
    Write-Host "Image appears fully transparent; copied without changes."; exit 0
  }

  $cropW = $maxX - $minX + 1
  $cropH = $maxY - $minY + 1

  $dest = New-Object System.Drawing.Bitmap($cropW, $cropH, $bmp.PixelFormat)
  $g = [System.Drawing.Graphics]::FromImage($dest)
  try {
    $srcRect = New-Object System.Drawing.Rectangle($minX, $minY, $cropW, $cropH)
    $dstRect = New-Object System.Drawing.Rectangle(0, 0, $cropW, $cropH)
    $g.DrawImage($bmp, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  } finally {
    $g.Dispose()
  }

  $dir = Split-Path -Parent $OutputPath
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $dest.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $dest.Dispose()
  Write-Host "Saved cropped image to $OutputPath ($cropW x $cropH)."
}
finally {
  $bmp.Dispose()
}
