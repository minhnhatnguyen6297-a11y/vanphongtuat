#Requires -Version 5.1
<#
.SYNOPSIS
  Mot lenh setup may con LAN: cai CA + goi y mo app.
.DESCRIPTION
  Chay bang Admin (SETUP-MAY-CON.cmd). Tim hng-root.cer canh script.
.PARAMETER CerPath
  Duong dan CA (mac dinh .\hng-root.cer).
.PARAMETER Url
  URL mo sau khi cai (mac dinh doc URL.txt neu co).
.PARAMETER OpenBrowser
  Mo Edge/Chrome sau khi cai (mac dinh bat).
#>
[CmdletBinding()]
param(
  [string]$CerPath,
  [string]$Url,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Can quyen Administrator. Hay chay SETUP-MAY-CON.cmd (Run as administrator).'
  }
}

Assert-Admin

$here = $PSScriptRoot
Write-Host "=== SETUP MAY CON — Hom Nay An Gi ==="

if (-not $CerPath) {
  $CerPath = Join-Path $here 'hng-root.cer'
}
if (-not (Test-Path $CerPath)) {
  throw "Khong thay hng-root.cer tai $CerPath. Copy tu may chu (client-pack)."
}

$installCa = Join-Path $here 'install-root-ca.ps1'
if (-not (Test-Path $installCa)) {
  # fallback: nhung logic ngan
  $imported = Import-Certificate -FilePath (Resolve-Path $CerPath) -CertStoreLocation 'Cert:\LocalMachine\Root'
  Write-Host "Da cai CA: $($imported.Thumbprint)"
} else {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installCa -CerPath $CerPath
}

# Goi y Private
Write-Host ""
Write-Host "Profile mang hien tai:"
Get-NetConnectionProfile -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host ("  {0}: {1}" -f $_.Name, $_.NetworkCategory)
  if ($_.NetworkCategory -ne 'Private') {
    try {
      Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private -ErrorAction Stop
      Write-Host "  -> Da doi sang Private."
    } catch {
      Write-Host "  -> Chua doi duoc Private (doi thu cong trong Settings → Network)."
    }
  }
}

if (-not $Url) {
  $urlFile = Join-Path $here 'URL.txt'
  if (Test-Path $urlFile) {
    $Url = (Get-Content $urlFile -Raw).Trim()
  }
}
if (-not $Url) { $Url = 'https://MAY3:8443' }

Write-Host ""
Write-Host "===== XONG MAY CON ====="
Write-Host "  Mo Chrome/Edge: $Url"
Write-Host "  Firefox: about:config → security.enterprise_roots.enabled = true"

if (-not $NoBrowser -and $Url) {
  $chrome = @(
    "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1

  try {
    if ($chrome) {
      Start-Process -FilePath $chrome -ArgumentList $Url
      Write-Host "  Da mo Chrome."
    } else {
      Write-Host "  Khong tim thay Chrome — mo bang trinh duyet mac dinh."
      Start-Process $Url
    }
  } catch {
    Write-Host "(Khong mo duoc trinh duyet tu dong — mo tay URL tren.)"
  }
}
