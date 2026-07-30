$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendUrl = "http://127.0.0.1:5175/"
$BackendHealthUrl = "http://127.0.0.1:8000/health"

function Test-LocalUrl {
    param([string] $Url)

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
    }
    catch {
        return $false
    }
}

function Wait-LocalUrl {
    param(
        [string] $Url,
        [int] $TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-LocalUrl $Url) {
            return $true
        }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Start-DevWindow {
    param(
        [string] $Title,
        [string] $Command
    )

    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-NoExit",
        "-Command",
        "`$Host.UI.RawUI.WindowTitle = '$Title'; Set-Location -LiteralPath '$Root'; $Command"
    )
}

Set-Location -LiteralPath $Root

Write-Host "SubsMarket local startup" -ForegroundColor Cyan
Write-Host "Project: $Root"

Write-Host "Preparing Docker, PostgreSQL and migrations..." -ForegroundColor Cyan
node scripts/ensure-local-infrastructure.mjs
if ($LASTEXITCODE -ne 0) {
    throw "Local infrastructure startup failed. See the error above."
}

$BackendReadyUrl = "http://127.0.0.1:8000/ready"
if (Test-LocalUrl $BackendReadyUrl) {
    Write-Host "Backend is ready: $BackendReadyUrl" -ForegroundColor Green
}
elseif (Test-LocalUrl $BackendHealthUrl) {
    throw "Backend process is running but the database is not ready. Restart the backend window."
}
else {
    Write-Host "Starting backend on http://127.0.0.1:8000..." -ForegroundColor Cyan
    Start-DevWindow -Title "SubsMarket backend" -Command "npm.cmd run dev:backend"
    if (-not (Wait-LocalUrl -Url $BackendReadyUrl -TimeoutSeconds 60)) {
        throw "Backend did not become ready within 60 seconds."
    }
}

if (Test-LocalUrl $FrontendUrl) {
    Write-Host "Frontend is already running: $FrontendUrl" -ForegroundColor Green
}
else {
    Write-Host "Starting frontend on $FrontendUrl..." -ForegroundColor Cyan
    Start-DevWindow -Title "SubsMarket frontend" -Command "npm.cmd --prefix frontend run dev -- --host 127.0.0.1 --port 5175 --strictPort"
    if (-not (Wait-LocalUrl -Url $FrontendUrl -TimeoutSeconds 30)) {
        throw "Frontend did not become ready within 30 seconds."
    }
}

Start-Process $FrontendUrl

Write-Host ""
Write-Host "Opened $FrontendUrl" -ForegroundColor Green
Write-Host "To stop servers, close the backend and frontend terminal windows." -ForegroundColor Yellow
