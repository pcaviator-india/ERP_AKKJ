@echo off
setlocal

echo Looking for backend on port 4000...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":4000" ^| findstr "LISTENING"') do (
  set "BACKEND_PID=%%P"
)

if not defined BACKEND_PID (
  echo No backend process found on port 4000.
  pause
  exit /b 0
)

echo Stopping backend process %BACKEND_PID%...
taskkill /PID %BACKEND_PID% /F

if errorlevel 1 (
  echo Failed to stop backend process.
  pause
  exit /b 1
)

echo Backend stopped.
pause