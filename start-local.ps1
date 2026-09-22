$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $Root

$Host.UI.RawUI.WindowTitle = "SubsMarket 3.0"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       SubsMarket 3.0 - Запуск локального окружения        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Папка проекта: $Root"
Write-Host "Подготовка Docker, базы данных и запуск серверов...`n" -ForegroundColor DarkGray

node scripts/dev.mjs --open
