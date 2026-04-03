@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

if not exist package.json (
  echo This file must be run from the ERP_AKKJ project root.
  pause
  exit /b 1
)

REM Initialize variables with defaults
set "DB_NAME=erp_akkj_local"
set "DB_USER=erpuser"
set "DB_PASSWORD=erppass123"

REM Check if .env exists and try to read existing credentials
if exist .env (
  echo Detected existing .env file.
  echo.
  echo Options:
  echo   1 - Use existing database (skip configuration)
  echo   2 - Enter new database credentials
  echo.
  set /p CHOICE=Enter your choice (1 or 2) [1]: 
  if "!CHOICE!"=="" set CHOICE=1
  
  if "!CHOICE!"=="1" (
    echo Using existing configuration from .env
    goto run_installer
  )
)

echo.
echo === Database Configuration ===
echo.

set /p DB_NAME=Enter new MySQL database name [%DB_NAME%]: 
set /p DB_USER=Enter MySQL app user [%DB_USER%]: 
set /p DB_PASSWORD=Enter MySQL app password [%DB_PASSWORD%]: 

:run_installer
echo.
echo Running installer...
powershell -ExecutionPolicy Bypass -File ".\scripts\install-local-native.ps1" -AutoInstallTools -DbName "!DB_NAME!" -DbUser "!DB_USER!" -DbPassword "!DB_PASSWORD!"

if errorlevel 1 (
  echo.
  echo Install failed.
  pause
  exit /b 1
)

echo Updating .env MySQL connection settings...
powershell -NoProfile -Command "$envPath='.env'; $db='!DB_NAME!'; $user='!DB_USER!'; $pass='!DB_PASSWORD!'; if (-not (Test-Path $envPath)) { @('MYSQL_DATABASE=' + $db, 'MYSQL_USER=' + $user, 'MYSQL_PASSWORD=' + $pass) | Set-Content -Path $envPath -Encoding utf8; exit 0 }; $content = Get-Content -Raw -Path $envPath; $pairs = @(@('MYSQL_DATABASE',$db), @('MYSQL_USER',$user), @('MYSQL_PASSWORD',$pass)); foreach ($pair in $pairs) { $key = $pair[0]; $value = $pair[1]; if ($content -match ('(?m)^' + [regex]::Escape($key) + '=')) { $content = [regex]::Replace($content, '(?m)^' + [regex]::Escape($key) + '=.*$', $key + '=' + $value) } else { if ($content.Length -gt 0 -and -not $content.EndsWith([Environment]::NewLine)) { $content += [Environment]::NewLine }; $content += $key + '=' + $value + [Environment]::NewLine } }; Set-Content -Path $envPath -Value $content -Encoding utf8"

if errorlevel 1 (
  echo.
  echo Install completed, but failed to update .env.
  pause
  exit /b 1
)

echo.
echo Install completed successfully.
echo Database: !DB_NAME!
echo User: !DB_USER!
exit /b 0
