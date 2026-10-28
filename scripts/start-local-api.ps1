param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-database.ps1')
$database = Get-LocalDatabaseConfiguration
$env:DATABASE_DRIVER = $database.Driver
$projectRoot = Split-Path -Parent $PSScriptRoot
$localDir = Join-Path $projectRoot '.local'
$binaryPath = [IO.Path]::GetFullPath((Join-Path $projectRoot 'target/debug/beeteam.exe'))
$runtimeDir = Join-Path $localDir 'api-runtime'
$runtimeBinary = Join-Path $runtimeDir 'beeteam.exe'
New-Item -ItemType Directory -Force $localDir | Out-Null
if ($database.ManagedPostgres) {
    $secretFile = Join-Path $localDir 'postgres.env'
    $containerName = 'beeteam-local-postgres'
    $volumeName = 'beeteam-local-pg18'
    if (-not (Test-Path -LiteralPath $secretFile)) {
        $priorContainer = & docker ps -a --filter "name=^/$containerName$" --format '{{.Names}}'
        if ($LASTEXITCODE -ne 0) { throw 'Docker is unavailable.' }
        $priorVolume = & docker volume ls --filter "name=^$volumeName$" --format '{{.Name}}'
        if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect existing storage.' }
        if ($priorContainer -or $priorVolume) { throw 'Existing Bee Team storage requires the original .local/postgres.env; no credentials or data were replaced.' }
        $password = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
        [IO.File]::WriteAllLines($secretFile, @('POSTGRES_USER=postgres', "POSTGRES_PASSWORD=$password", 'POSTGRES_DB=beeteam_local'))
    }
    $passwordLine = Get-Content -LiteralPath $secretFile | Where-Object { $_.StartsWith('POSTGRES_PASSWORD=') }
    $password = $passwordLine.Substring('POSTGRES_PASSWORD='.Length)
    $dockerEnvFile = $secretFile
    $dockerCommand = Get-Command docker
    if ($dockerCommand.Source.EndsWith('.bat') -and ((Get-Content -LiteralPath $dockerCommand.Source -Raw) -match 'wsl.exe -d Ubuntu')) {
        $dockerEnvFile = (& wsl.exe -d Ubuntu -- wslpath -u ($secretFile.Replace('\', '/'))).Trim()
        if ($LASTEXITCODE -ne 0) { throw 'Could not translate the local environment file for the Docker WSL wrapper.' }
    }
    $existing = & docker ps -a --filter "name=^/$containerName$" --format '{{.Names}}'
    if ($LASTEXITCODE -ne 0) { throw 'Docker is unavailable.' }
    if ($existing -eq $containerName) {
        & docker start $containerName | Out-Null
    } else {
        & docker run -d --name $containerName --restart unless-stopped -p '127.0.0.1:55482:5432' --env-file $dockerEnvFile --mount "type=volume,source=$volumeName,target=/var/lib/postgresql" postgres:18 | Out-Null
    }
    if ($LASTEXITCODE -ne 0) { throw 'Could not start the dedicated PostgreSQL container. Existing data was not removed.' }
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        & docker exec $containerName pg_isready -U postgres -d beeteam_local *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw 'PostgreSQL did not become ready.' }
    $env:DATABASE_URL = "postgres://postgres:$password@127.0.0.1:55482/beeteam_local"
} else {
    $env:DATABASE_URL = $database.Url
}
$apiPidFile = Join-Path $localDir 'api.pid'
if (Test-Path -LiteralPath $apiPidFile) {
    $existingPid = [int](Get-Content -LiteralPath $apiPidFile)
    $existingProcess = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($existingProcess -and $existingProcess.Path -in @($binaryPath, $runtimeBinary)) {
        Invoke-RestMethod -Uri 'http://127.0.0.1:18081/health' -TimeoutSec 2 | Out-Null
        Write-Output "Bee Team API already running at http://127.0.0.1:18081 (PID $existingPid). Existing database settings were not changed; restart the API to apply different settings."
        exit 0
    }
}
if (Get-NetTCPConnection -State Listen -LocalPort 18081 -ErrorAction SilentlyContinue) { throw 'Port 18081 is occupied; no process was stopped.' }
if (-not $SkipBuild) {
    Push-Location $projectRoot
    try { & cargo build --locked --features mcp; if ($LASTEXITCODE -ne 0) { throw 'Build failed.' } }
    finally { Pop-Location }
}
$env:APP_HOST = '127.0.0.1'
$env:APP_PORT = '18081'
$env:OTEL_ENABLED = 'false'
$env:MCP_ENABLED = 'true'
$env:APP_CORS_ALLOW_ORIGINS = 'http://127.0.0.1:5173,http://localhost:5173'
$env:MCP_ALLOWED_ORIGINS = $env:APP_CORS_ALLOW_ORIGINS
New-Item -ItemType Directory -Force $runtimeDir | Out-Null
Copy-Item -LiteralPath $binaryPath -Destination $runtimeBinary -Force
$process = Start-Process -FilePath $runtimeBinary -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localDir 'api.stdout.log') -RedirectStandardError (Join-Path $localDir 'api.stderr.log') -PassThru
[IO.File]::WriteAllText($apiPidFile, [string]$process.Id)
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        Invoke-RestMethod -Uri 'http://127.0.0.1:18081/health' -TimeoutSec 2 | Out-Null
        Write-Output "Bee Team API ready at http://127.0.0.1:18081 (PID $($process.Id)); storage driver $($database.Driver)."
        exit 0
    } catch {
        if ($process.HasExited) { throw 'API exited; inspect .local/api.stderr.log. Database and volume are preserved.' }
        Start-Sleep -Seconds 1
    }
}
throw 'API did not become ready; inspect .local logs. No existing data was removed.'
