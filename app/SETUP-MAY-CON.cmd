@echo off
:: Alias → client-pack\MAY-CON.cmd
if exist "%~dp0client-pack\MAY-CON.cmd" (
  call "%~dp0client-pack\MAY-CON.cmd"
) else if exist "%~dp0client-pack\SETUP-MAY-CON.cmd" (
  call "%~dp0client-pack\SETUP-MAY-CON.cmd"
) else (
  echo Chay MAY-CHU.cmd tren may chu truoc de tao client-pack.
  pause
)
