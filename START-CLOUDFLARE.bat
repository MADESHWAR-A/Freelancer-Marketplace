@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo       WORKLY - CLOUDFLARE QUICK TUNNEL
echo ============================================
echo.

if exist "cloudflared.exe" (
  echo Using .\cloudflared.exe
  .\cloudflared.exe tunnel --url http://localhost:3000
  goto :done
)

where cloudflared >nul 2>nul
if errorlevel 1 (
  echo ERROR: cloudflared was not found.
  echo.
  echo Download it from:
  echo https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
  echo.
  echo Then place cloudflared.exe in this project folder and run this file again.
  pause
  exit /b 1
)

cloudflared tunnel --url http://localhost:3000

:done
pause
