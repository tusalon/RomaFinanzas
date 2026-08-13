param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9]{20}$')]
    [string]$TargetProjectRef,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://[a-z0-9-]+\.supabase\.co/?$')]
    [string]$RservasRomaUrl,

    [Parameter(Mandatory = $true)]
    [string]$AllowedOrigins
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($env:ROMA_RSERVASROMA_ANON_KEY)) {
    throw 'Falta ROMA_RSERVASROMA_ANON_KEY. Guardala temporalmente en esa variable de entorno; no la pegues en chats.'
}

if ([string]::IsNullOrWhiteSpace($AllowedOrigins)) {
    throw 'AllowedOrigins no puede quedar vacio.'
}

$privateDirectory = Join-Path $PSScriptRoot '..\private-setup'
$resolvedPrivateDirectory = [System.IO.Path]::GetFullPath($privateDirectory)
New-Item -ItemType Directory -Path $resolvedPrivateDirectory -Force | Out-Null

$secretsFile = Join-Path $resolvedPrivateDirectory "federated-secrets-$TargetProjectRef.env"

try {
    @(
        "RSERVASROMA_SUPABASE_URL=$($RservasRomaUrl.TrimEnd('/'))"
        "RSERVASROMA_SUPABASE_ANON_KEY=$($env:ROMA_RSERVASROMA_ANON_KEY)"
        "ROMA_ALLOWED_ORIGINS=$AllowedOrigins"
    ) | Set-Content -LiteralPath $secretsFile -Encoding utf8

    & npx --yes supabase@latest secrets set `
        --env-file $secretsFile `
        --project-ref $TargetProjectRef
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudieron guardar los secretos. Codigo $LASTEXITCODE"
    }

    & npx --yes supabase@latest functions deploy rservasroma-login `
        --project-ref $TargetProjectRef
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo desplegar rservasroma-login. Codigo $LASTEXITCODE"
    }

    Write-Host 'Funcion federada desplegada.' -ForegroundColor Green
} finally {
    if (Test-Path -LiteralPath $secretsFile) {
        Remove-Item -LiteralPath $secretsFile -Force
    }
}
