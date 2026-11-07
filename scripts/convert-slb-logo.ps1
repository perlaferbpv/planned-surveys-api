# Convierte el EPS oficial a PNG para GitHub Pages (requiere tools/gs o Ghostscript en PATH).
param(
    [string] $Eps = "$PSScriptRoot\..\web\brand\SLB_Logo_Positive_Pantone_R.eps",
    [string] $OutPng = "$PSScriptRoot\..\web\slb-logo.png",
    [int] $Dpi = 300
)

$gs = "$PSScriptRoot\..\tools\gs\bin\gswin64c.exe"
if (-not (Test-Path $gs)) {
    $cmd = Get-Command gswin64c -ErrorAction SilentlyContinue
    if ($cmd) { $gs = $cmd.Source }
}
if (-not $gs) {
    Write-Error "Instala Ghostscript o ejecuta una vez la conversión desde este proyecto (carpeta tools\gs)."
    exit 1
}
if (-not (Test-Path $Eps)) {
    Write-Error "No se encuentra el EPS: $Eps"
    exit 1
}

& $gs -dNOSAFER -dNOPAUSE -dBATCH -dEPSCrop -sDEVICE=png16m "-r$Dpi" "-sOutputFile=$OutPng" $Eps
if (-not (Test-Path $OutPng)) {
    Write-Error "No se generó $OutPng"
    exit 1
}
Write-Host "Logo actualizado: $OutPng"
