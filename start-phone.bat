@echo off
rem Local start that also opens the app to a phone on the same Wi-Fi.
set "SUBS_LAN=1"
set "ROOT=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%start-local.ps1"
if errorlevel 1 pause
