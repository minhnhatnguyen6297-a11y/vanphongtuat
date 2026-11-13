@echo off
title Hom Nay An Gi — MAY CHU
:: Mot file duy nhat tren may chu:
::  - Lan dau: cai CA, firewall, Task Scheduler, client-pack
::  - Lan sau / sau reboot (neu can): dam bao server dang chay
::  - Sau khi cai xong: KHONG can giu cua so nay; bat may se tu chay.
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
cd /d "%~dp0"
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\setup-server.ps1" %*
set ERR=%ERRORLEVEL%
echo.
if not "%ERR%"=="0" (
  echo LOI — xem thong bao tren. Log: C:\hng\logs\
) else (
  echo Co the DONG cua so nay. Server chay ngam.
)
echo.
pause
exit /b %ERR%
