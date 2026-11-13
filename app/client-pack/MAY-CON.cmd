@echo off
:: SETUP MAY CON ? Hom Nay An Gi (chay Admin, 1 lan moi may)
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-client.ps1"
echo.
pause
