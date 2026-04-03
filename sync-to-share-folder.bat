@echo off
setlocal

set "SOURCE_DIR=%~dp0"
set "TARGET_DIR=C:\Users\world\Desktop\EPRAKKJ"

if not exist "%SOURCE_DIR%package.json" (
  echo This script must be run from the ERP_AKKJ project root.
  pause
  exit /b 1
)

if not exist "%TARGET_DIR%" (
  echo Target folder not found: %TARGET_DIR%
  pause
  exit /b 1
)

echo Syncing project to:
echo   %TARGET_DIR%
echo.

robocopy "%SOURCE_DIR%" "%TARGET_DIR%" ^
  /E ^
  /XD ".git" "node_modules" "client\node_modules" "client\dist" "uploads\tmp" "backups" ^
  /XF ".env" ".env.*" "*.log" "*.tmp" ^
  /R:2 /W:1 /NP /NDL /NFL

set "RC=%ERRORLEVEL%"

if %RC% GEQ 8 (
  echo.
  echo Sync failed with robocopy exit code %RC%.
  pause
  exit /b %RC%
)

echo.
echo Sync complete.
pause