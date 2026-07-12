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

if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "Starting local PostgreSQL..." -ForegroundColor Cyan
    docker compose up -d postgres
}
else {
    Write-Host "Docker was not found in PATH. PostgreSQL may already be running; continuing." -ForegroundColor Yellow
}

if (Test-LocalUrl $BackendHealthUrl) {
    Write-Host "Backend is already running: $BackendHealthUrl" -ForegroundColor Green
}
else {
    Write-Host "Starting backend on http://127.0.0.1:8000..." -ForegroundColor Cyan
    Start-DevWindow -Title "SubsMarket backend" -Command "npm.cmd run dev:backend"
}

if (Test-LocalUrl $FrontendUrl) {
    Write-Host "Frontend is already running: $FrontendUrl" -ForegroundColor Green
}
else {
    Write-Host "Starting frontend on $FrontendUrl..." -ForegroundColor Cyan
    Start-DevWindow -Title "SubsMarket frontend" -Command "npm.cmd --prefix frontend run dev -- --host 127.0.0.1 --port 5175 --strictPort"
}

Start-Sleep -Seconds 4
Start-Process $FrontendUrl

Write-Host ""
Write-Host "Opened $FrontendUrl" -ForegroundColor Green
Write-Host "To stop servers, close the backend and frontend terminal windows." -ForegroundColor Yellow
