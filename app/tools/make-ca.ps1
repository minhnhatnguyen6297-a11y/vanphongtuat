#Requires -Version 5.1
<#
.SYNOPSIS
  Tao CA noi bo "Hom Nay An Gi Root" + chung chi may chu MAY3 (1 nam).
.DESCRIPTION
  Chay tren MAY3. Khoa CA: C:\hng-ca\ (chi tai khoan van hanh).
  Chung chi may chu: C:\hng\tls\server.pfx (+ pem neu OpenSSL co san).
  Khong dua C:\hng-ca\ hay *.pfx vao git.
.PARAMETER ServerIp
  IP co dinh cua MAY3 (SAN).
.PARAMETER DnsName
  Ten DNS/host (mac dinh MAY3).
.PARAMETER CaYears
  Han CA goc (mac dinh 5).
.PARAMETER ServerYears
  Han chung chi may chu (mac dinh 1).
.PARAMETER PfxPassword
  Mat khau PFX (mac dinh tao ngau nhien, ghi ra C:\hng\tls\pfx.password.txt).
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ServerIp,

  [string]$DnsName = 'MAY3',

  [int]$CaYears = 5,

  [int]$ServerYears = 1,

  [SecureString]$PfxPassword
)

$ErrorActionPreference = 'Stop'

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Can quyen Administrator de tao/xuat chung chi may chu.'
  }
}

function New-RandomPassword {
  $bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return [Convert]::ToBase64String($bytes)
}

Assert-Admin

$caDir = 'C:\hng-ca'
$tlsDir = 'C:\hng\tls'
New-Item -ItemType Directory -Force -Path $caDir | Out-Null
New-Item -ItemType Directory -Force -Path $tlsDir | Out-Null

# Chi tai khoan hien tai + SYSTEM doc duoc CA
icacls $caDir /inheritance:r | Out-Null
icacls $caDir /grant:r "${env:USERNAME}:(OI)(CI)F" | Out-Null
icacls $caDir /grant:r "SYSTEM:(OI)(CI)F" | Out-Null

$caSubject = 'CN=Hom Nay An Gi Root'
$existingCa = Get-ChildItem Cert:\LocalMachine\My |
  Where-Object { $_.Subject -eq $caSubject -and $_.HasPrivateKey } |
  Sort-Object NotAfter -Descending |
  Select-Object -First 1

if ($existingCa) {
  Write-Host "Dung lai CA hien co: $($existingCa.Thumbprint)"
  $caCert = $existingCa
} else {
  Write-Host "Tao CA goc ($CaYears nam)..."
  $caCert = New-SelfSignedCertificate `
    -Subject $caSubject `
    -KeyExportPolicy Exportable `
    -KeyLength 4096 `
    -KeyAlgorithm RSA `
    -HashAlgorithm SHA256 `
    -KeyUsage CertSign, CRLSign, DigitalSignature `
    -KeyUsageProperty All `
    -Provider 'Microsoft Enhanced RSA and AES Cryptographic Provider' `
    -NotAfter (Get-Date).AddYears($CaYears) `
    -CertStoreLocation 'Cert:\LocalMachine\My' `
    -TextExtension @('2.5.29.19={critical}{text}ca=1&pathlength=0')
}

$caCerPath = Join-Path $caDir 'hng-root.cer'
Export-Certificate -Cert $caCert -FilePath $caCerPath -Type CERT | Out-Null
Write-Host "Da xuat CA public: $caCerPath"

$pwdFile = Join-Path $tlsDir 'pfx.password.txt'
if (-not $PfxPassword) {
  if (Test-Path $pwdFile) {
    $plain = (Get-Content $pwdFile -Raw).Trim()
    if (-not $plain) { throw "File mat khau rong: $pwdFile" }
    $PfxPassword = ConvertTo-SecureString -String $plain -AsPlainText -Force
    Write-Host "Dung lai mat khau PFX: $pwdFile"
  } else {
    $plain = New-RandomPassword
    $PfxPassword = ConvertTo-SecureString -String $plain -AsPlainText -Force
    Set-Content -Path $pwdFile -Value $plain -Encoding ASCII
    icacls $pwdFile /inheritance:r | Out-Null
    icacls $pwdFile /grant:r "${env:USERNAME}:(R,W)" | Out-Null
    icacls $pwdFile /grant:r "SYSTEM:(R,W)" | Out-Null
    icacls $pwdFile /grant:r "Administrators:(F)" | Out-Null
    Write-Host "Mat khau PFX ghi tai: $pwdFile (chi tai khoan van hanh)."
  }
}

# Xoa chung chi may chu cu cung subject neu co
Get-ChildItem Cert:\LocalMachine\My |
  Where-Object { $_.Subject -eq "CN=$DnsName" -and $_.Issuer -eq $caSubject } |
  ForEach-Object {
    Write-Host "Xoa cert may chu cu: $($_.Thumbprint)"
    Remove-Item $_.PSPath -Force
  }

Write-Host "Tao chung chi may chu ($ServerYears nam), SAN=$DnsName,$ServerIp ..."
$serverCert = New-SelfSignedCertificate `
  -Subject "CN=$DnsName" `
  -Signer $caCert `
  -KeyExportPolicy Exportable `
  -KeyLength 2048 `
  -KeyAlgorithm RSA `
  -HashAlgorithm SHA256 `
  -KeyUsage DigitalSignature, KeyEncipherment `
  -TextExtension @(
    '2.5.29.37={text}1.3.6.1.5.5.7.3.1',
    "2.5.29.17={text}DNS=$DnsName&IPAddress=$ServerIp"
  ) `
  -NotAfter (Get-Date).AddYears($ServerYears) `
  -CertStoreLocation 'Cert:\LocalMachine\My'

$pfxPath = Join-Path $tlsDir 'server.pfx'
Export-PfxCertificate -Cert $serverCert -FilePath $pfxPath -Password $PfxPassword | Out-Null
Write-Host "Da xuat PFX: $pfxPath"

# Xuat PEM cho Node (openssl → ExportPkcs8 → PKCS#1 cho WinPS 5.1)
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($PfxPassword)
$plainPwd = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
$pemKey = Join-Path $tlsDir 'server-key.pem'
$pemCert = Join-Path $tlsDir 'server-cert.pem'

function Encode-Asn1Length([int]$len) {
  if ($len -lt 0x80) { return [byte[]]@([byte]$len) }
  if ($len -lt 0x100) { return [byte[]]@(0x81, [byte]$len) }
  return [byte[]]@(0x82, [byte](($len -shr 8) -band 0xff), [byte]($len -band 0xff))
}

function Encode-Asn1Integer([byte[]]$raw) {
  $i = 0
  while ($i -lt $raw.Length - 1 -and $raw[$i] -eq 0) { $i++ }
  $body = $raw[$i..($raw.Length - 1)]
  if ($body[0] -ge 0x80) {
    $body = [byte[]](@(0) + $body)
  }
  return [byte[]](@(0x02) + (Encode-Asn1Length $body.Length) + $body)
}

function Encode-Asn1Sequence([byte[]]$content) {
  return [byte[]](@(0x30) + (Encode-Asn1Length $content.Length) + $content)
}

function ConvertTo-RsaPrivateKeyPem([System.Security.Cryptography.RSA]$rsa) {
  $p = $rsa.ExportParameters($true)
  $payload = New-Object System.Collections.Generic.List[byte]
  foreach ($chunk in @(
      (Encode-Asn1Integer ([byte[]]@(0))),
      (Encode-Asn1Integer $p.Modulus),
      (Encode-Asn1Integer $p.Exponent),
      (Encode-Asn1Integer $p.D),
      (Encode-Asn1Integer $p.P),
      (Encode-Asn1Integer $p.Q),
      (Encode-Asn1Integer $p.DP),
      (Encode-Asn1Integer $p.DQ),
      (Encode-Asn1Integer $p.InverseQ)
    )) {
    foreach ($b in [byte[]]$chunk) { [void]$payload.Add([byte]$b) }
  }
  $der = Encode-Asn1Sequence ($payload.ToArray())
  $b64 = [Convert]::ToBase64String($der, [Base64FormattingOptions]::InsertLineBreaks)
  return ("-----BEGIN RSA PRIVATE KEY-----`r`n" + $b64 + "`r`n-----END RSA PRIVATE KEY-----")
}

$openssl = Get-Command openssl -ErrorAction SilentlyContinue
if ($openssl) {
  & openssl pkcs12 -in $pfxPath -nocerts -nodes -passin "pass:$plainPwd" -out $pemKey 2>$null
  & openssl pkcs12 -in $pfxPath -clcerts -nokeys -passin "pass:$plainPwd" -out $pemCert 2>$null
  Write-Host "Da xuat PEM (openssl): $pemCert / $pemKey"
} else {
  Add-Type -AssemblyName System.Security
  $flags = [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable -bor
    [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::MachineKeySet
  $loaded = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($pfxPath, $plainPwd, $flags)
  $certDer = $loaded.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
  $certB64 = [Convert]::ToBase64String($certDer, [Base64FormattingOptions]::InsertLineBreaks)
  Set-Content -Path $pemCert -Value ("-----BEGIN CERTIFICATE-----`r`n" + $certB64 + "`r`n-----END CERTIFICATE-----") -Encoding ASCII

  $rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($loaded)
  if (-not $rsa) { throw 'Khong doc duoc private key tu PFX de xuat PEM.' }

  # WinPS 5.1 / .NET Framework: dung PKCS#1 (khong co ExportPkcs8PrivateKey)
  Set-Content -Path $pemKey -Value (ConvertTo-RsaPrivateKeyPem $rsa) -Encoding ASCII
  Write-Host "Da xuat PEM (PKCS1 / WinPS): $pemCert / $pemKey"
}

if (-not (Test-Path $pemCert) -or -not (Test-Path $pemKey)) {
  throw "Xuat PEM that bai: $pemCert / $pemKey"
}

icacls $pemKey /inheritance:r | Out-Null
icacls $pemKey /grant:r "${env:USERNAME}:R" | Out-Null
icacls $pemKey /grant:r "SYSTEM:R" | Out-Null

Write-Host ""
Write-Host "XONG. Buoc tiep:"
Write-Host "  1) Copy $caCerPath sang may tram, chay install-root-ca.ps1 (Admin)."
Write-Host "  2) Dat HNG_TLS_CERT / HNG_TLS_KEY (pem) hoac cau hinh doc PFX trong .env MAY3."
Write-Host "  3) Gia han cert may chu hang nam (xem docs/VAN-HANH.md)."
