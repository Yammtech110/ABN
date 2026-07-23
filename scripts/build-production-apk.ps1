# Live-updating production APK — WebView loads https://abn-1.onrender.com
# After this APK is installed once, UI updates when Render Static Site redeploys.
#
# Usage: .\scripts\build-production-apk.ps1
#        .\scripts\build-production-apk.ps1 -LiveUrl "https://abn-1.onrender.com"

param(
  [string]$ApiUrl = "",
  [string]$LiveUrl = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if ($ApiUrl) {
  $envFile = Join-Path $Root ".env.production"
  if (Test-Path $envFile) {
    $lines = Get-Content $envFile | ForEach-Object {
      if ($_ -match '^\s*VITE_API_BASE_URL=') { "VITE_API_BASE_URL=$ApiUrl" } else { $_ }
    }
    if (-not ($lines -match '^\s*VITE_API_BASE_URL=')) {
      $lines += "VITE_API_BASE_URL=$ApiUrl"
    }
    $lines | Set-Content $envFile -Encoding UTF8
  } else {
    "VITE_API_BASE_URL=$ApiUrl" | Set-Content $envFile -Encoding UTF8
  }
  Write-Host "Set VITE_API_BASE_URL=$ApiUrl"
}

if (-not (Test-Path (Join-Path $Root ".env.production"))) {
  Write-Error "Missing .env.production - copy .env.production.example and set VITE_API_BASE_URL"
}

Write-Host "Building web bundle (fallback assets)..."
npm run build

Write-Host "Syncing Capacitor (LIVE web from Render Static Site)..."
$env:CAPACITOR_PRODUCTION = "true"
if ($LiveUrl) {
  $env:CAPACITOR_SERVER_URL = $LiveUrl
  Write-Host "CAPACITOR_SERVER_URL=$LiveUrl"
} else {
  $env:CAPACITOR_SERVER_URL = "https://abn-1.onrender.com"
}
npx cap sync android

Write-Host "Building APK..."
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
Set-Location (Join-Path $Root "android")
.\gradlew.bat assembleDebug

$apkSrc = Join-Path $Root "android\app\build\outputs\apk\debug\app-debug.apk"
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$downloads = Join-Path $env:USERPROFILE "Downloads"
$desktopCandidates = @(
  (Join-Path $env:USERPROFILE "OneDrive\Desktop"),
  (Join-Path $env:USERPROFILE "Desktop")
) | Where-Object { Test-Path $_ }

$named = Join-Path $downloads "ABN-LiveUpdate-$stamp.apk"
Copy-Item -Force $apkSrc $named
foreach ($desk in $desktopCandidates) {
  Copy-Item -Force $apkSrc (Join-Path $desk "ABN-LiveUpdate-$stamp.apk")
  Copy-Item -Force $apkSrc (Join-Path $desk "ABN-Community-App-Global.apk")
}

Write-Host ""
Write-Host "Done! Live-update APK:" $named
Write-Host "This shell loads https://abn-1.onrender.com — redeploy Static Site to push UI updates (no new APK)."
