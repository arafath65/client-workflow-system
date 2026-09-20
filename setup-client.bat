@echo off
setlocal
title Client Workflow System Setup

echo ==========================================
echo   Client Workflow System - First Setup
echo ==========================================
echo.

REM Move to the folder containing this script
cd /d "%~dp0"

REM Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed.
    pause
    exit /b 1
)

REM Check npm
where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not available.
    pause
    exit /b 1
)

REM Check MySQL client
where mysql >nul 2>&1
if errorlevel 1 (
    echo ERROR: MySQL command-line client not found.
    echo Install MySQL and ensure mysql.exe is in PATH.
    pause
    exit /b 1
)

echo.
echo Step 1: Create database if it does not exist
echo.

mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS client_workflow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if errorlevel 1 (
    echo ERROR: Database creation failed.
    pause
    exit /b 1
)

echo.
echo Step 2: Install project dependencies
echo.

call npm ci
if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

echo.
echo Step 3: Generate Prisma Client
echo.

call npx prisma generate
if errorlevel 1 (
    echo ERROR: Prisma Client generation failed.
    pause
    exit /b 1
)

echo.
echo Step 4: Apply database migrations
echo.

call npx prisma migrate deploy
if errorlevel 1 (
    echo ERROR: Prisma migrations failed.
    pause
    exit /b 1
)

echo.
echo Step 5: Build application
echo.

call npm run build
if errorlevel 1 (
    echo ERROR: Next.js build failed.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   Setup completed successfully!
echo ==========================================
echo.
echo Starting Client Workflow System...
echo.

call npm start

pause