# Production APK build — backend must be live on Render first
# Usage: .\scripts\build-production-apk.ps1
#        .\scripts\build-production-apk.ps1 -ApiUrl "https://your-api.onrender.com"

param(
  [string]$ApiUrl = ""
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
  Write-Error "Missing .env.production — copy .env.production.example and set VITE_API_BASE_URL"
}

Write-Host "Building web bundle (production)..."
npm run build

Write-Host "Syncing Capacitor (production mode)..."
$env:CAPACITOR_PRODUCTION = "true"
npx cap sync android

Write-Host "Building APK..."
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
Set-Location (Join-Path $Root "android")
.\gradlew.bat assembleDebug

$apkSrc = Join-Path $Root "android\app\build\outputs\apk\debug\app-debug.apk"
$apkDst = Join-Path $env:USERPROFILE "Desktop\ABN-Community-App-Global.apk"
Copy-Item -Force $apkSrc $apkDst

Write-Host ""
Write-Host "Done! Global APK:" $apkDst
Write-Host "Share this APK with clients in any country — they all hit your cloud backend."
