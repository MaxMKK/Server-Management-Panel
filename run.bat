@echo off
cls
title Minecraft Server Management Panel

:menu
echo ============================================
echo     Minecraft Server Management Panel      =
echo ============================================
echo.
echo 1. Start Development Server (API + Web)
echo 2. Start API Server Only
echo 3. Start Web Server Only
echo 4. Exit
echo.
set /p choice="Select an option: "

if "%choice%"=="1" goto start_dev
if "%choice%"=="2" goto start_api
if "%choice%"=="3" goto start_web
if "%choice%"=="4" goto end

goto menu

:start_dev
echo.
echo Starting development server (API + Web)...
echo This may take a few minutes...
echo.
npm run dev

goto menu

:start_api
echo.
echo Starting API server only...
echo.
npx concurrently -k -n "api" -c "cyan" "npm run dev:api"

goto menu

:start_web
echo.
echo Starting web server only...
echo.
npx concurrently -k -n "web" -c "magenta" "npm run dev:web"

goto menu

:end
echo.
echo Exiting...
echo.
