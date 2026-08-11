param(
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,

    [string]$PgBin = ''
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($env:ROMA_DATABASE_URL)) {
    throw 'Falta ROMA_DATABASE_URL. Copia la conexión Session Pooler desde Supabase y guárdala temporalmente en esa variable de entorno.'
}

$pgDumpCommand = if ($PgBin) { Join-Path $PgBin 'pg_dump.exe' } else { 'pg_dump' }
$pgRestoreCommand = if ($PgBin) { Join-Path $PgBin 'pg_restore.exe' } else { 'pg_restore' }

if ($PgBin) {
    if (-not (Test-Path -LiteralPath $pgDumpCommand)) { throw "No existe $pgDumpCommand" }
    if (-not (Test-Path -LiteralPath $pgRestoreCommand)) { throw "No existe $pgRestoreCommand" }
} else {
    if (-not (Get-Command $pgDumpCommand -ErrorAction SilentlyContinue)) {
        throw 'No se encontró pg_dump. Instala PostgreSQL Client Tools o indica su carpeta con -PgBin.'
    }
    if (-not (Get-Command $pgRestoreCommand -ErrorAction SilentlyContinue)) {
        throw 'No se encontró pg_restore. Instala PostgreSQL Client Tools o indica su carpeta con -PgBin.'
    }
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupFile = Join-Path $resolvedOutput "roma-finanzas-production-$timestamp.dump"
$schemaFile = Join-Path $resolvedOutput "roma-finanzas-production-schema-$timestamp.sql"
$catalogFile = Join-Path $resolvedOutput "roma-finanzas-production-catalog-$timestamp.txt"
$hashFile = Join-Path $resolvedOutput "roma-finanzas-production-sha256-$timestamp.txt"

$commonArguments = @(
    '--dbname', $env:ROMA_DATABASE_URL,
    '--schema', 'public',
    '--no-owner',
    '--no-privileges'
)

Write-Host 'Creando copia completa del esquema public...'
& $pgDumpCommand @commonArguments '--format=custom' '--file' $backupFile
if ($LASTEXITCODE -ne 0) { throw "pg_dump terminó con código $LASTEXITCODE" }

Write-Host 'Creando copia legible del esquema...'
& $pgDumpCommand @commonArguments '--schema-only' '--format=plain' '--file' $schemaFile
if ($LASTEXITCODE -ne 0) { throw "pg_dump del esquema terminó con código $LASTEXITCODE" }

Write-Host 'Verificando que el archivo pueda ser leído por pg_restore...'
& $pgRestoreCommand '--list' $backupFile | Out-File -LiteralPath $catalogFile -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "pg_restore no pudo leer la copia. Código $LASTEXITCODE" }

$backupInfo = Get-Item -LiteralPath $backupFile
$schemaInfo = Get-Item -LiteralPath $schemaFile
$catalogInfo = Get-Item -LiteralPath $catalogFile
if ($backupInfo.Length -le 0 -or $schemaInfo.Length -le 0 -or $catalogInfo.Length -le 0) {
    throw 'La copia produjo uno o más archivos vacíos.'
}

@(
    Get-FileHash -Algorithm SHA256 -LiteralPath $backupFile
    Get-FileHash -Algorithm SHA256 -LiteralPath $schemaFile
) | ForEach-Object { "$($_.Hash)  $($_.Path)" } | Out-File -LiteralPath $hashFile -Encoding utf8

Write-Host ''
Write-Host 'RESPALDO CREADO Y LEGIBLE' -ForegroundColor Green
Write-Host "Copia:    $backupFile"
Write-Host "Esquema:  $schemaFile"
Write-Host "Catálogo: $catalogFile"
Write-Host "Hashes:   $hashFile"
Write-Host ''
Write-Host 'Guarda una segunda copia en otro disco o ubicación protegida antes de migrar.'

