@echo off
title KSA JOBS - Master Control Panel
:menu
cls
color 0F
echo ============================================================
echo                 KSA JOBS - MASTER CONTROL PANEL
echo ============================================================
echo.
echo   [1] Start Everything (Bot Service + Web Portal)
echo   [2] Start Autonomous Bot Service Only
echo   [3] Start Web Portal Only (http://localhost:3000)
echo   [4] WhatsApp Login / Show QR Code
echo   [5] Scan CV Inbox (Gmail) Once
echo   [6] Rebuild All Packages
echo   [7] Exit
echo.
echo ============================================================
set /p choice="Enter option [1-7]: "

if "%choice%"=="1" (
    start "KSA JOBS - Web Portal" cmd /k "cd /d %~dp0\apps\web && pnpm start"
    start "KSA JOBS - Bot Service" cmd /k "cd /d %~dp0\services\bot && pnpm start"
    goto menu
)
if "%choice%"=="2" (
    start "KSA JOBS - Bot Service" cmd /k "cd /d %~dp0\services\bot && pnpm start"
    goto menu
)
if "%choice%"=="3" (
    start "KSA JOBS - Web Portal" cmd /k "cd /d %~dp0\apps\web && pnpm start"
    goto menu
)
if "%choice%"=="4" (
    start "KSA JOBS - WhatsApp QR" cmd /k "cd /d %~dp0 && pnpm qr"
    goto menu
)
if "%choice%"=="5" (
    start "KSA JOBS - CV Inbox Scan" cmd /k "cd /d %~dp0 && pnpm scan:gmail"
    goto menu
)
if "%choice%"=="6" (
    echo.
    echo Rebuilding all packages...
    cd /d %~dp0
    call pnpm build
    echo [Done] Build complete!
    pause
    goto menu
)
if "%choice%"=="7" exit

echo Invalid choice. Please try again.
pause
goto menu
