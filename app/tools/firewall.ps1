#Requires -Version 5.1
<#
.SYNOPSIS
  Mo cong HTTPS cho profile Private (LAN van phong).
.DESCRIPTION
  Chi mo profile Private — khong Public/Domain/Guest.
  Kiem tra mang may tram dang Private truoc khi dung.
.PARAMETER Port
  Cong HTTPS (mac dinh 8443 = HNG_PORT).
.PARAMETER RuleName
  Ten rule (mac dinh HNG-HTTPS).
.PARAMETER Remove
  Xoa rule thay vi tao.
#>
[CmdletBinding()]
param(
  [int]$Port = 8443,
  [string]$RuleName = 'HNG-HTTPS',
  [switch]$Remove
)

$ErrorActionPreference = 'Stop'

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Can quyen Administrator de sua Windows Firewall.'
  }
}

Assert-Admin

if ($Remove) {
  Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue |
    Remove-NetFirewallRule
  Write-Host "Da xoa rule '$RuleName' (neu co)."
  return
}

Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue |
  Remove-NetFirewallRule

New-NetFirewallRule `
  -DisplayName $RuleName `
  -Name $RuleName `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort $Port `
  -Profile Private `
  -Description "Hom Nay An Gi — HTTPS/WSS LAN (Private only)" | Out-Null

Write-Host "Da mo TCP $Port cho profile Private (rule: $RuleName)."
Write-Host ""
Write-Host "Kiem tra profile mang hien tai:"
Get-NetConnectionProfile | ForEach-Object {
  Write-Host ("  {0}: {1}" -f $_.Name, $_.NetworkCategory)
}
Write-Host "May tram phai la Private. Neu Public: Set-NetConnectionProfile -InterfaceAlias '...' -NetworkCategory Private"
