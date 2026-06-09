$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$www = Join-Path $root "www"

if (Test-Path $www) {
    Remove-Item -LiteralPath $www -Recurse -Force
}

New-Item -ItemType Directory -Path $www | Out-Null

$files = @(
    "index.html",
    "manifest.json",
    "sw.js",
    "app.js"
)

$directories = @(
    "components",
    "utils",
    "views",
    "icons",
    "vendor",
    "trickle"
)

foreach ($file in $files) {
    $source = Join-Path $root $file
    if (Test-Path $source) {
        Copy-Item -LiteralPath $source -Destination (Join-Path $www $file) -Force
    }
}

foreach ($directory in $directories) {
    $source = Join-Path $root $directory
    if (Test-Path $source) {
        Copy-Item -LiteralPath $source -Destination (Join-Path $www $directory) -Recurse -Force
    }
}

Write-Host "Capacitor web assets prepared in $www"
