@echo off
setlocal

title Client Workflow System

REM Move to the project folder
cd /d "%~dp0"

echo ==========================================
echo   Client Workflow System
echo ==========================================
echo.

REM Check whether the production build exists
if not exist ".next" (
    echo ERROR: Application build not found.
    echo Please run setup-client.bat first.
    pause
    exit /b 1
)

REM Start the Next.js app in a separate window
echo Starting Client Workflow System...

start "Client Workflow System Server" cmd /k "cd /d ""%~dp0"" && npm start"

REM Wait for the application to respond
echo Waiting for application to start...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url = 'http://localhost:3000';" ^
  "$ready = $false;" ^
  "for ($i = 0; $i -lt 60; $i++) {" ^
  "  try {" ^
  "    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2;" ^
  "    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {" ^
  "      $ready = $true; break" ^
  "    }" ^
  "  } catch {};" ^
  "  Start-Sleep -Seconds 1" ^
  "};" ^
  "if ($ready) { Start-Process $url; exit 0 } else { exit 1 }"

if errorlevel 1 (
    echo.
    echo ERROR: App did not respond at localhost:3000.
    echo Check the server window for errors.
    pause
    exit /b 1
)

echo.
echo Client Workflow System is running.
echo Browser opened at http://localhost:3000
echo.

endlocal