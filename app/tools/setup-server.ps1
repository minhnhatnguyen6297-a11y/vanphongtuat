#Requires -Version 5.1
<#
.SYNOPSIS
  Mot lenh may chu: cai dat lan dau HOAC dam bao server dang chay (sau reboot).
.PARAMETER EnsureOnly
  Chi kiem tra mang/firewall + start Task (khong build/CA).
.PARAMETER ForceSetup
  Ep cai dat day du lai (ke ca khi da cai).
.PARAMETER ServerIp / DnsName / Port / SkipNpm / Seed
  Nhu cu.
#>
[CmdletBinding()]
param(
  [string]$ServerIp,
  [string]$DnsName = $env:COMPUTERNAME,
  [int]$Port = 8443,
  [switch]$SkipNpm,
  [switch]$Seed,
  [switch]$EnsureOnly,
  [switch]$ForceSetup
)

$ErrorActionPreference = 'Stop'

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Can quyen Administrator. Hay chay MAY-CHU.cmd (tu nang quyen Admin).'
  }
}

function Get-LanIPv4 {
  $rows = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.PrefixOrigin -ne 'WellKnown'
    } |
    Sort-Object -Property @{
      Expression = {
        if ($_.IPAddress -like '192.168.*') { 0 }
        elseif ($_.IPAddress -like '10.*') { 1 }
        elseif ($_.IPAddress -like '172.*') { 2 }
        else { 9 }
      }
      Ascending = $true
    }
  return @($rows | Select-Object -ExpandProperty IPAddress -Unique)
}

function Set-LanPrivate {
  Get-NetConnectionProfile -ErrorAction SilentlyContinue | ForEach-Object {
    $alias = $_.InterfaceAlias
    if ($alias -match 'Tailscale|Loopback|vEthernet|Hyper-V|WSL') { return }
    if ($_.NetworkCategory -ne 'Private') {
      try {
        Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private -ErrorAction Stop
        Write-Host "  $alias : -> Private"
      } catch {
        Write-Host "  $alias : khong doi duoc Private"
      }
    } else {
      Write-Host "  $alias : Private (ok)"
    }
  }
}

function Start-HngServer([string]$AppDir, [int]$Port, [string]$toolsDir) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $toolsDir 'firewall.ps1') -Port $Port
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $toolsDir 'install-task.ps1') -AppDir $AppDir

  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object {
      try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
    }
  Start-Sleep -Seconds 1
  Start-ScheduledTask -TaskName 'HNG-Server' -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 3
  $task = Get-ScheduledTask -TaskName 'HNG-Server' -ErrorAction SilentlyContinue
  $listen = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  Write-Host ("  Task: {0}" -f $(if ($task) { $task.State } else { 'missing' }))
  Write-Host ("  Port {0}: {1}" -f $Port, $(if ($listen) { 'LISTEN' } else { 'CHUA LANG NGHE — xem C:\hng\logs' }))
  return [bool]$listen
}

function Get-OriginFromEnv([string]$AppDir, [int]$Port) {
  $envPath = Join-Path $AppDir '.env'
  if (Test-Path $envPath) {
    $m = Select-String -Path $envPath -Pattern '^\s*HNG_ORIGIN\s*=\s*(.+)\s*$' | Select-Object -First 1
    if ($m) { return $m.Matches[0].Groups[1].Value.Trim() }
  }
  return "https://localhost:$Port"
}

function Write-ClientPack([string]$AppDir, [string]$toolsDir, [string]$origin) {
  $pack = Join-Path $AppDir 'client-pack'
  New-Item -ItemType Directory -Force -Path $pack | Out-Null
  if (Test-Path 'C:\hng-ca\hng-root.cer') {
    Copy-Item 'C:\hng-ca\hng-root.cer' (Join-Path $pack 'hng-root.cer') -Force
  }
  Copy-Item (Join-Path $toolsDir 'setup-client.ps1') (Join-Path $pack 'setup-client.ps1') -Force
  Copy-Item (Join-Path $toolsDir 'install-root-ca.ps1') (Join-Path $pack 'install-root-ca.ps1') -Force
  $cmdClient = @'
@echo off
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
cd /d "%~dp0"
if not exist "%~dp0hng-root.cer" (
  echo Thieu hng-root.cer — copy tu may chu sau khi chay MAY-CHU.cmd
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-client.ps1"
echo.
pause
'@
  Set-Content -Path (Join-Path $pack 'SETUP-MAY-CON.cmd') -Value $cmdClient -Encoding ASCII
  # Mot file ten gon
  Copy-Item (Join-Path $pack 'SETUP-MAY-CON.cmd') (Join-Path $pack 'MAY-CON.cmd') -Force
  Set-Content -Path (Join-Path $pack 'URL.txt') -Value $origin -Encoding ASCII
  $readme = @"
MAY CON — Hom Nay An Gi
=======================
1) Copy CA NHAN thu muc client-pack sang may tram.
2) Chay MAY-CON.cmd (Admin) — 1 lan / may.
3) Chrome mo: $origin

Khong can chay lai khi may chu cap nhat app (chi F5).
Chi chay lai khi doi CA (lam lai MAY-CHU tren may chu).
"@
  Set-Content -Path (Join-Path $pack 'README.txt') -Value $readme -Encoding UTF8
  return $pack
}

Assert-Admin

$toolsDir = $PSScriptRoot
$AppDir = (Resolve-Path (Join-Path $toolsDir '..')).Path
Write-Host "=== MAY CHU — Hom Nay An Gi ==="
Write-Host "AppDir: $AppDir"

$configured =
  (Test-Path (Join-Path $AppDir '.env')) -and
  (Test-Path 'C:\hng\tls\server.pfx') -and
  (Test-Path (Join-Path $AppDir 'dist\server\index.js'))

if (-not $ForceSetup -and ($EnsureOnly -or $configured)) {
  if (-not $EnsureOnly -and $configured) {
    Write-Host "Da cai dat truoc do → che do DAM BAO CHAY (khong setup lai)."
    Write-Host "Muon cai lai day du: MAY-CHU.cmd -ForceSetup"
  }

  $origin = Get-OriginFromEnv $AppDir $Port
  Write-Host "`n[1/3] Mang LAN Private..."
  Set-LanPrivate
  Write-Host "`n[2/3] Firewall + Task HNG-Server..."
  $ok = Start-HngServer $AppDir $Port $toolsDir
  Write-Host "`n[3/3] client-pack..."
  $pack = Write-ClientPack $AppDir $toolsDir $origin

  Write-Host ""
  Write-Host "===== SERVER SAN SANG ====="
  Write-Host "  URL: $origin"
  Write-Host "  Khong can giu cua so nay — Task Scheduler chay ngam."
  Write-Host "  Sau tat/bat may: tu chay lai (khong can bam file)."
  Write-Host "  Neu loi: chay lai MAY-CHU.cmd"
  Write-Host "  May con: $pack\MAY-CON.cmd"
  if (-not $ok) { exit 1 }
  return
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  throw 'Chua cai Node.js LTS (https://nodejs.org). Cai xong chay lai MAY-CHU.cmd.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'Khong tim thay npm trong PATH.'
}

if (-not $ServerIp) {
  $cands = Get-LanIPv4
  if ($cands.Count -eq 0) { throw 'Khong doan duoc IP LAN. Them -ServerIp 192.168.x.x' }
  if ($cands.Count -eq 1) {
    $ServerIp = $cands[0]
  } else {
    Write-Host "Chon IP LAN (may khac se goi URL nay):"
    for ($i = 0; $i -lt $cands.Count; $i++) {
      Write-Host ("  [{0}] {1}" -f ($i + 1), $cands[$i])
    }
    Write-Host "  Goi y: chon 192.168.x.x (Wi-Fi/Ethernet van phong), tranh Tailscale/Hyper-V."
    $pick = Read-Host "Chon so (Enter = 1)"
    if ([string]::IsNullOrWhiteSpace($pick)) { $pick = '1' }
    $idx = [int]$pick - 1
    if ($idx -lt 0 -or $idx -ge $cands.Count) { throw 'Lua chon IP khong hop le.' }
    $ServerIp = $cands[$idx]
  }
}
Write-Host "ServerIp=$ServerIp  DnsName=$DnsName  Port=$Port"

try { powercfg /change standby-timeout-ac 0 | Out-Null } catch { }
Set-Location $AppDir

if (-not $SkipNpm) {
  Write-Host "`n[1/6] npm install + build..."
  & npm install --no-fund --no-audit
  if ($LASTEXITCODE -ne 0) { throw "npm install that bai ($LASTEXITCODE)" }
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build that bai ($LASTEXITCODE)" }
} else {
  Write-Host "`n[1/6] Bo qua npm (SkipNpm)."
  if (-not (Test-Path (Join-Path $AppDir 'dist\server\index.js'))) {
    throw 'Chua co dist\server\index.js'
  }
}

Write-Host "`n[2/6] Tao CA + chung chi HTTPS..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $toolsDir 'make-ca.ps1') `
  -ServerIp $ServerIp -DnsName $DnsName
if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
  throw "make-ca.ps1 that bai (exit $LASTEXITCODE)."
}
if (-not (Test-Path 'C:\hng\tls\server-cert.pem') -or -not (Test-Path 'C:\hng\tls\server-key.pem')) {
  throw 'Thieu PEM sau make-ca. Kiem tra C:\hng\tls\'
}

Write-Host "`n[3/6] Viet .env..."
New-Item -ItemType Directory -Force -Path 'C:\hng\data', 'C:\hng\backup', 'C:\hng\logs' | Out-Null
$origin = "https://${ServerIp}:${Port}"
$pfxPass = ''
$pfxPassFile = 'C:\hng\tls\pfx.password.txt'
if (Test-Path $pfxPassFile) { $pfxPass = (Get-Content $pfxPassFile -Raw).Trim() }
$envLines = @(
  "HNG_PORT=$Port"
  "HNG_ORIGIN=$origin"
  'HNG_DB=C:\hng\data\hng.db'
  'HNG_TLS_CERT=C:\hng\tls\server-cert.pem'
  'HNG_TLS_KEY=C:\hng\tls\server-key.pem'
  'HNG_TLS_PFX=C:\hng\tls\server.pfx'
  "HNG_TLS_PFX_PASS=$pfxPass"
  'HNG_DEV_HTTP=0'
  'HNG_BACKUP_DIR=C:\hng\backup'
  'HNG_AI_PROVIDER=claude'
  'HNG_AI_KEY='
  'HNG_AI_MODEL=claude-sonnet-4-20250514'
)
Set-Content -Path (Join-Path $AppDir '.env') -Value ($envLines -join "`r`n") -Encoding UTF8
Write-Host "  ORIGIN = $origin"

if ($Seed) {
  Write-Host "`n[3b] npm run seed..."
  & npm run seed
}

Write-Host "`n[4/6] Mang Private + firewall..."
Set-LanPrivate

Write-Host "`n[5/6] Task Scheduler (tu chay moi khi bat may)..."
$ok = Start-HngServer $AppDir $Port $toolsDir

Write-Host "`n[6/6] Goi may con..."
$pack = Write-ClientPack $AppDir $toolsDir $origin

Write-Host ""
Write-Host "===== XONG — CHI CAN 1 LAN ====="
Write-Host "  URL          : $origin"
Write-Host "  Terminal     : DONG duoc — server chay ngam (Task HNG-Server)."
Write-Host "  Tat/bat may  : TU CHAY LAI — khong can bam file."
Write-Host "  Sua/loi      : chay lai MAY-CHU.cmd"
Write-Host "  May con      : copy $pack → chay MAY-CON.cmd (Admin, 1 lan/may)"
Write-Host "  DB           : C:\hng\data\hng.db"
Write-Host "  Log          : C:\hng\logs\"
if (-not $ok) { exit 1 }
