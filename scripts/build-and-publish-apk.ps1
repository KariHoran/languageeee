# Builds Android APK via EAS and copies it into public/downloads/languageeee.apk
# Usage:
#   $env:EXPO_TOKEN = "your_token_from_https://expo.dev/settings/access-tokens"
#   powershell -File scripts/build-and-publish-apk.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not $env:EXPO_TOKEN) {
  Write-Host "Set EXPO_TOKEN first: https://expo.dev/settings/access-tokens"
  exit 1
}

$env:JAVA_HOME = if (Test-Path "$env:USERPROFILE\jdk-17") { "$env:USERPROFILE\jdk-17" } else { $env:JAVA_HOME }

Write-Host "==> whoami"
npx eas-cli whoami

Write-Host "==> ensure project linked"
npx eas-cli init --id --non-interactive 2>$null
npx eas-cli build:configure -p android --non-interactive 2>$null

Write-Host "==> start Android APK build (preview)"
npx eas-cli build -p android --profile preview --non-interactive --wait

Write-Host "==> download latest APK"
$outDir = Join-Path (Get-Location) "tmp-apk"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
npx eas-cli build:download --platform android --latest --output $outDir --non-interactive

$apk = Get-ChildItem $outDir -Filter *.apk -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $apk) {
  Write-Host "APK not found in $outDir"
  exit 1
}

$destDir = Join-Path (Get-Location) "public\downloads"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$dest = Join-Path $destDir "languageeee.apk"
Copy-Item $apk.FullName $dest -Force
Write-Host "==> copied to $dest ($([math]::Round($apk.Length/1MB,1)) MB)"

Write-Host "==> deploy to Vercel production"
npx vercel --prod --yes

Write-Host "Done. APK: /downloads/languageeee.apk"
