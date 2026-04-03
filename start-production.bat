@echo off
setlocal

cd /d "%~dp0"

if not exist package.json (
  echo This file must be run from the ERP_AKKJ project root.
  pause
  exit /b 1
)

echo Running from folder: %~dp0
if exist .env (
  for /f "tokens=1,* delims==" %%A in ('findstr /b /c:"MYSQL_HOST=" /c:"MYSQL_PORT=" /c:"MYSQL_USER=" /c:"MYSQL_DATABASE=" .env') do (
    echo %%A=%%B
  )
) else (
  echo .env not found in this folder.
)
echo.

echo Building frontend for production...
call npm --prefix client run build

if errorlevel 1 (
  echo.
  echo Frontend build failed.
  pause
  exit /b 1
)

echo Starting backend on port 4000...
if not exist logs mkdir logs
start "ERP_AKKJ Backend" cmd /k "cd /d ""%~dp0"" && npm start > logs\backend-start.log 2>&1"
echo Backend start requested. See logs\backend-start.log if the window closes.

echo Waiting for backend port 4000 to become available...
powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(90); while ((Get-Date) -lt $deadline) { try { $client = New-Object System.Net.Sockets.TcpClient; $iar = $client.BeginConnect('127.0.0.1', 4000, $null, $null); $ok = $iar.AsyncWaitHandle.WaitOne(1000, $false); if ($ok -and $client.Connected) { $client.EndConnect($iar); $client.Close(); exit 0 } if ($client.Connected) { $client.Close() } } catch { } Start-Sleep -Milliseconds 500 }; exit 1"

if errorlevel 1 (
  echo.
  echo Backend did not become available within 90 seconds.
  echo Check the "ERP_AKKJ Backend" terminal window for errors.
  pause
  exit /b 1
)

start "" "http://localhost:4000/"
