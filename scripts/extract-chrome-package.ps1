param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath,

  [Parameter(Mandatory = $true)]
  [string]$Destination
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $InstallerPath -PathType Leaf)) {
  throw "Google Chrome installer not found: $InstallerPath"
}
if (Test-Path -LiteralPath $Destination) {
  throw "Extraction destination already exists: $Destination"
}

$installer = Get-Item -LiteralPath $InstallerPath
$installerVersion = $installer.VersionInfo.ProductVersion
if ($installer.VersionInfo.ProductName -ne 'Google Chrome Installer' -or $installerVersion -notmatch '^109\.') {
  throw "Unexpected installer identity: $($installer.VersionInfo.ProductName) $installerVersion"
}
$installerSignature = Get-AuthenticodeSignature -FilePath $installer.FullName
if ($installerSignature.Status -ne 'Valid' -or $installerSignature.SignerCertificate.Subject -notmatch 'CN=Google LLC') {
  throw "The standalone installer is not validly signed by Google LLC: $($installerSignature.Status), $($installerSignature.SignerCertificate.Subject)"
}

New-Item -ItemType Directory -Path $Destination | Out-Null

$source = @'
using System;
using System.Runtime.InteropServices;

public static class ChromePackageResourceReader {
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern IntPtr LoadLibraryEx(string fileName, IntPtr file, uint flags);

  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern IntPtr FindResource(IntPtr module, string name, string type);

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern uint SizeofResource(IntPtr module, IntPtr resource);

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern IntPtr LoadResource(IntPtr module, IntPtr resource);

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern IntPtr LockResource(IntPtr resourceData);

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool FreeLibrary(IntPtr module);
}
'@
Add-Type -TypeDefinition $source

$module = [ChromePackageResourceReader]::LoadLibraryEx($installer.FullName, [IntPtr]::Zero, 0x22)
if ($module -eq [IntPtr]::Zero) {
  throw "Could not open the signed Chrome installer as a data file (Win32 $([Runtime.InteropServices.Marshal]::GetLastWin32Error()))."
}
try {
  $resource = [ChromePackageResourceReader]::FindResource($module, 'CHROME.PACKED.7Z', 'B7')
  if ($resource -eq [IntPtr]::Zero) {
    throw "The signed Chrome installer does not contain CHROME.PACKED.7Z/B7 (Win32 $([Runtime.InteropServices.Marshal]::GetLastWin32Error()))."
  }
  $resourceLength = [ChromePackageResourceReader]::SizeofResource($module, $resource)
  $resourceData = [ChromePackageResourceReader]::LoadResource($module, $resource)
  $resourcePointer = [ChromePackageResourceReader]::LockResource($resourceData)
  if ($resourceLength -eq 0 -or $resourcePointer -eq [IntPtr]::Zero) {
    throw 'The Chrome archive resource was empty or could not be read.'
  }

  $archivePath = Join-Path $Destination 'chrome.packed.7z'
  $archiveBytes = New-Object byte[] $resourceLength
  [Runtime.InteropServices.Marshal]::Copy($resourcePointer, $archiveBytes, 0, [int]$resourceLength)
  [IO.File]::WriteAllBytes($archivePath, $archiveBytes)
  Write-Host "Read Chrome archive resource from Google-signed installer ($resourceLength bytes)."
}
finally {
  [void][ChromePackageResourceReader]::FreeLibrary($module)
}

$sevenZip = Get-Command '7z.exe' -ErrorAction SilentlyContinue
if (-not $sevenZip) {
  $sevenZipPath = @(
    (Join-Path $env:ProgramFiles '7-Zip\7z.exe'),
    (Join-Path ${env:ProgramFiles(x86)} '7-Zip\7z.exe')
  ) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
  if ($sevenZipPath) { $sevenZip = Get-Item -LiteralPath $sevenZipPath }
}
if (-not $sevenZip) { throw '7-Zip is required to unpack the verified Chrome archive in the disposable runner.' }
$outerPath = Join-Path $Destination 'outer'
$browserPath = Join-Path $Destination 'browser'
New-Item -ItemType Directory -Path $outerPath, $browserPath | Out-Null

& $sevenZip.Source x $archivePath "-o$outerPath" -y | Out-Host
if ($LASTEXITCODE -ne 0) {
  throw "7-Zip could not extract the Chrome package wrapper (exit code $LASTEXITCODE)."
}

$innerArchives = @(Get-ChildItem -LiteralPath $outerPath -Filter 'chrome.7z' -File -Recurse)
if ($innerArchives.Count -ne 1) {
  throw "Expected exactly one chrome.7z in the package; found $($innerArchives.Count)."
}

& $sevenZip.Source x $innerArchives[0].FullName "-o$browserPath" -y | Out-Host
if ($LASTEXITCODE -ne 0) {
  throw "7-Zip could not extract the Chrome browser payload (exit code $LASTEXITCODE)."
}

$chromeExecutables = @(Get-ChildItem -LiteralPath $browserPath -Filter 'chrome.exe' -File -Recurse)
if ($chromeExecutables.Count -ne 1) {
  throw "Expected exactly one chrome.exe in the browser payload; found $($chromeExecutables.Count)."
}

$chrome = Get-Item -LiteralPath $chromeExecutables[0].FullName
$productName = $chrome.VersionInfo.ProductName
$productVersion = $chrome.VersionInfo.ProductVersion
if ($productName -ne 'Google Chrome') {
  throw "Unexpected extracted browser product '$productName' at $($chrome.FullName)."
}
if ($productVersion -notmatch '^109\.') {
  throw "Expected Google Chrome 109, found '$productVersion'."
}
$chromeSignature = Get-AuthenticodeSignature -FilePath $chrome.FullName
if ($chromeSignature.Status -ne 'Valid' -or $chromeSignature.SignerCertificate.Subject -notmatch 'CN=Google LLC') {
  throw "Extracted chrome.exe does not have a valid Google LLC signature: $($chromeSignature.Status), $($chromeSignature.SignerCertificate.Subject)"
}

Write-Host "Extracted browser: $productName $productVersion; signature $($chromeSignature.Status), $($chromeSignature.SignerCertificate.Subject)."
Write-Output $chrome.FullName
