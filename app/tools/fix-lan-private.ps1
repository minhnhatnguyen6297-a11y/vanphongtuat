#Requires -Version 5.1
# Doi Ethernet/Wi-Fi sang Private de rule HNG-HTTPS co hieu luc.
$ErrorActionPreference = 'Stop'
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$p = New-Object Security.Principal.WindowsPrincipal($id)
if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Can Admin. Chay: powershell -ExecutionPolicy Bypass -File tools\fix-lan-private.ps1'
}
Get-NetConnectionProfile | ForEach-Object {
  $alias = $_.InterfaceAlias
  if ($alias -match 'Tailscale|Loopback|vEthernet|Hyper-V|WSL') {
    Write-Host "Bo qua $alias ($($_.NetworkCategory))"
    return
  }
  if ($_.NetworkCategory -ne 'Private') {
    Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private
    Write-Host "OK $alias -> Private"
  } else {
    Write-Host "OK $alias da Private"
  }
}
Get-NetConnectionProfile | Format-Table Name, InterfaceAlias, NetworkCategory
