#Requires -Version 5.1
<#
.SYNOPSIS
  Cai chung chi goc "Hom Nay An Gi Root" vao LocalMachine\Root tren may tram.
.DESCRIPTION
  Chay MOT LAN tren moi may tram bang quyen Administrator.
  Chrome/Edge tren Windows dung kho nay. Firefox can policy
  security.enterprise_roots.enabled = true.
.PARAMETER CerPath
  Duong dan toi hng-root.cer (mac dinh cung thu muc script hoac C:\hng-ca\hng-root.cer).
#>
[CmdletBinding()]
param(
  [string]$CerPath
)

$ErrorActionPreference = 'Stop'

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Can quyen Administrator de Import-Certificate vao LocalMachine\Root.'
  }
}

Assert-Admin

if (-not $CerPath) {
  $candidates = @(
    (Join-Path $PSScriptRoot 'hng-root.cer'),
    'C:\hng-ca\hng-root.cer',
    (Join-Path (Split-Path $PSScriptRoot -Parent) 'hng-root.cer')
  )
  $CerPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $CerPath -or -not (Test-Path $CerPath)) {
  throw "Khong tim thay hng-root.cer. Truyen -CerPath hoac copy file vao $PSScriptRoot."
}

$cerFull = (Resolve-Path $CerPath).Path
Write-Host "Import $cerFull -> Cert:\LocalMachine\Root"

$imported = Import-Certificate -FilePath $cerFull -CertStoreLocation 'Cert:\LocalMachine\Root'
Write-Host "Da cai CA:"
Write-Host "  Subject    : $($imported.Subject)"
Write-Host "  Thumbprint : $($imported.Thumbprint)"
Write-Host "  NotAfter   : $($imported.NotAfter)"
Write-Host ""
Write-Host "Mo Chrome/Edge, vao https://MAY3:8443 (hoac IP) — khong con canh bao cert."
Write-Host "Neu dung Firefox: about:config -> security.enterprise_roots.enabled = true."
