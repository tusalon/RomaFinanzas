$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
$www = Join-Path $root "www"

if (-not (Test-Path $dist)) {
    throw "No se encontro dist. Ejecuta primero: npm run build:web"
}

if (Test-Path $www) {
    Remove-Item -LiteralPath $www -Recurse -Force
}

New-Item -ItemType Directory -Path $www | Out-Null
Copy-Item -Path (Join-Path $dist "*") -Destination $www -Recurse -Force

Write-Host "Capacitor web assets prepared in $www"
