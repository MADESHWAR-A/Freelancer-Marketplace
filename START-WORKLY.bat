@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo        WORKLY - REVIEW READY STARTUP
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not in PATH.
  echo Install Node.js 20+ and run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\express" (
  echo Installing project dependencies...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo Starting Workly...
echo Open http://localhost:3000
 echo Health check: http://localhost:3000/api/health
echo.
call npm start
pause
