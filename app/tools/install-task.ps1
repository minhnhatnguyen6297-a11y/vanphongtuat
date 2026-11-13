#Requires -Version 5.1
<#
.SYNOPSIS
  Tao Task Scheduler chay app khi Windows khoi dong.
.DESCRIPTION
  - Trigger: AtStartup
  - Chay SYSTEM (khong cho dang nhap), tu chay lai khi loi: 3 lan / 1 phut
  - Log quay vong: C:\hng\logs\ (app khong duoc ghi PIN, cookie, API key, anh)
.PARAMETER AppDir
  Thu muc app (mac dinh D:\vanphongtuat\app).
.PARAMETER NodeExe
  Duong dan node.exe (mac dinh tu PATH).
.PARAMETER TaskName
  Ten task (mac dinh HNG-Server).
.PARAMETER RunAsUser
  Neu truyen, chay bang user do (hoi mat khau) thay vi SYSTEM.
#>
[CmdletBinding()]
param(
  [string]$AppDir = 'D:\vanphongtuat\app',
  [string]$NodeExe,
  [string]$TaskName = 'HNG-Server',
  [string]$RunAsUser
)

$ErrorActionPreference = 'Stop'

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Can quyen Administrator de dang ky Task Scheduler.'
  }
}

Assert-Admin

$AppDir = (Resolve-Path $AppDir).Path
if (-not $NodeExe) {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $cmd) { throw 'Khong tim thay node.exe trong PATH. Truyen -NodeExe.' }
  $NodeExe = $cmd.Source
}

$logDir = 'C:\hng\logs'
$dataDir = 'C:\hng'
New-Item -ItemType Directory -Force -Path $logDir, $dataDir | Out-Null

$wrapperPath = Join-Path $dataDir 'run-hng.ps1'
@(
  '$ErrorActionPreference = "Continue"'
  "`$app = '$AppDir'"
  '$logDir = "C:\hng\logs"'
  'New-Item -ItemType Directory -Force -Path $logDir | Out-Null'
  '$stamp = Get-Date -Format "yyyyMMdd"'
  '$out = Join-Path $logDir "hng-$stamp.out.log"'
  '$err = Join-Path $logDir "hng-$stamp.err.log"'
  'Get-ChildItem $logDir -Filter "hng-*.log" -ErrorAction SilentlyContinue |'
  '  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } |'
  '  Remove-Item -Force -ErrorAction SilentlyContinue'
  'Set-Location $app'
  'if (-not $env:HNG_PORT) { $env:HNG_PORT = "8443" }'
  "`$node = '$NodeExe'"
  '$dist = Join-Path $app "dist\server\index.js"'
  'if (Test-Path $dist) {'
  '  & $node $dist 1>> $out 2>> $err'
  '} else {'
  '  $tsx = Join-Path $app "node_modules\tsx\dist\cli.mjs"'
  '  if (-not (Test-Path $tsx)) { throw "Chua build dist va khong co tsx." }'
  '  & $node $tsx (Join-Path $app "src\server\index.ts") 1>> $out 2>> $err'
  '}'
) | Set-Content -Path $wrapperPath -Encoding UTF8

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$wrapperPath`"" `
  -WorkingDirectory $AppDir

$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

if ($RunAsUser) {
  $cred = Get-Credential -UserName $RunAsUser -Message 'Mat khau tai khoan chay HNG-Server'
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -User $cred.UserName -Password $cred.GetNetworkCredential().Password -Force | Out-Null
} else {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Principal $principal -Force | Out-Null
}

$entryHint = if (Test-Path (Join-Path $AppDir 'dist\server\index.js')) {
  Join-Path $AppDir 'dist\server\index.js'
} else {
  Join-Path $AppDir 'src\server\index.ts'
}

Write-Host "Da dang ky task '$TaskName'."
Write-Host "  Entry uu tien : $entryHint"
Write-Host "  Wrapper       : $wrapperPath"
Write-Host "  Logs          : $logDir"
Write-Host "Chay thu: Start-ScheduledTask -TaskName '$TaskName'"
