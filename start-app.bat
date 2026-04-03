@echo off
setlocal

cd /d "%~dp0"

if not exist package.json (
  echo This file must be run from the ERP_AKKJ project root.
  pause
  exit /b 1
)

echo Starting ERP_AKKJ...
start "ERP_AKKJ Dev Server" cmd /k "cd /d ""%~dp0"" && npm run dev:both"

echo Waiting for http://localhost:5173/ to become available...
powershell -NoProfile -Command "$url='http://localhost:5173/'; $deadline=(Get-Date).AddSeconds(60); while ((Get-Date) -lt $deadline) { try { $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { Start-Process $url; exit 0 } } catch { Start-Sleep -Milliseconds 500 } }; exit 1"

if errorlevel 1 (
  echo.
  echo The app did not become available within 60 seconds.
  pause
)