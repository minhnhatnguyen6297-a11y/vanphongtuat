# Run AFTER closing Cursor windows that still point at D:\vanphongtuat
# (File Explorer + any node server on the old path too.)
$ErrorActionPreference = "Stop"
Set-Location "C:\Users\Toan Phat"

Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

if (Test-Path "D:\vanphongtuat") {
  cmd /c "rmdir /s /q D:\vanphongtuat"
  if (Test-Path "D:\vanphongtuat") {
    throw "Still locked: close Cursor indexing the old path, then rerun."
  }
}

if (-not (Test-Path "D:\vanphongtuat-promoting\.git")) {
  throw "Missing D:\vanphongtuat-promoting — abort"
}

Rename-Item "D:\vanphongtuat-promoting" "vanphongtuat"
Write-Host "OK: repo is now D:\vanphongtuat (flat). Re-open that folder in Cursor."
