
@echo off
setlocal

title Client Workflow System Setup

cd /d "%~dp0"

echo ==========================================
echo   Client Workflow System - First Setup
echo ==========================================
echo.

REM ==========================================
REM Step 0: Check Node.js
REM ==========================================

echo Checking Node.js...

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed.
    echo Install Node.js LTS from https://nodejs.org/
    pause
    exit /b 1
)

node -v
echo.

REM ==========================================
REM Check npm
REM ==========================================

echo Checking npm...

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not available.
    echo Reinstall Node.js or check your PATH.
    pause
    exit /b 1
)

npm -v
echo.

REM ==========================================
REM Step 1: Locate MySQL command-line client
REM ==========================================

echo Searching for MySQL command-line client...

set "MYSQL_BIN="

REM First check Windows PATH
where mysql.exe >nul 2>&1
if not errorlevel 1 (
    set "MYSQL_BIN=mysql.exe"
    goto MYSQL_FOUND
)

REM Check common MySQL installation locations
if exist "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" (
    set "MYSQL_BIN=C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
    goto MYSQL_FOUND
)

if exist "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" (
    set "MYSQL_BIN=C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe"
    goto MYSQL_FOUND
)

if exist "C:\Program Files\MySQL\MySQL Server 9.0\bin\mysql.exe" (
    set "MYSQL_BIN=C:\Program Files\MySQL\MySQL Server 9.0\bin\mysql.exe"
    goto MYSQL_FOUND
)

if exist "C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysql.exe" (
    set "MYSQL_BIN=C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysql.exe"
    goto MYSQL_FOUND
)

REM MySQL may be installed in a custom folder.
echo.
echo ERROR: MySQL command-line client not found.
echo.
echo Please install MySQL Server and locate mysql.exe.
echo Or add its bin folder to Windows PATH.
echo.
pause
exit /b 1

:MYSQL_FOUND

echo MySQL client found:
echo %MYSQL_BIN%
echo.

"%MYSQL_BIN%" --version
if errorlevel 1 (
    echo ERROR: MySQL client could not run.
    pause
    exit /b 1
)

REM ==========================================
REM Step 2: Create database if it does not exist
REM ==========================================

echo.
echo ==========================================
echo Step 1: Create database
echo ==========================================
echo.

echo Enter your MySQL root password when prompted.
echo.

"%MYSQL_BIN%" -u root -p -e "CREATE DATABASE IF NOT EXISTS client_workflow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if errorlevel 1 (
    echo.
    echo ERROR: Database creation failed.
    echo Check that MySQL is running and your root password is correct.
    pause
    exit /b 1
)

echo.
echo Database is ready.
echo.

REM ==========================================
REM Step 3: Install project dependencies
REM ==========================================

echo.
echo ==========================================
echo Step 2: Install project dependencies
echo ==========================================
echo.

call npm ci

if errorlevel 1 (
    echo.
    echo ERROR: npm ci failed.
    pause
    exit /b 1
)

REM ==========================================
REM Step 4: Generate Prisma Client
REM ==========================================

echo.
echo ==========================================
echo Step 3: Generate Prisma Client
echo ==========================================
echo.

call npx prisma generate

if errorlevel 1 (
    echo.
    echo ERROR: Prisma Client generation failed.
    pause
    exit /b 1
)

REM ==========================================
REM Step 5: Apply database migrations
REM ==========================================

echo.
echo ==========================================
echo Step 4: Apply database migrations
echo ==========================================
echo.

call npx prisma migrate deploy

if errorlevel 1 (
    echo.
    echo ERROR: Prisma migrations failed.
    echo Check your .env DATABASE_URL and migration files.
    pause
    exit /b 1
)

REM ==========================================
REM Step 6: Build application
REM ==========================================

echo.
echo ==========================================
echo Step 5: Build application
echo ==========================================
echo.

call npm run build

if errorlevel 1 (
    echo.
    echo ERROR: Next.js build failed.
    pause
    exit /b 1
)

REM ==========================================
REM Setup completed
REM ==========================================

echo.
echo ==========================================
echo   Setup completed successfully!
echo ==========================================
echo.
echo Starting Client Workflow System...
echo.
echo Keep this window open while using the app.
echo.

call npm start

echo.
echo Application has stopped.
pause

endlocal