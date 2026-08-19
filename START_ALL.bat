@echo off
title KSA JOBS - Launch All Services
color 0A
echo ============================================================
echo           KSA JOBS - PRODUCTION LAUNCHER (ALL SERVICES)
echo ============================================================
echo.
echo Launching KSA Jobs Autonomous Bot and Web Portal...
echo.

start "KSA JOBS - Web Portal (Port 3000)" cmd /k "cd /d %~dp0\apps\web && pnpm start"
start "KSA JOBS - Autonomous Bot Service" cmd /k "cd /d %~dp0\services\bot && pnpm start"

echo.
echo [OK] Both services have been launched in separate windows!
echo - Web Portal: http://localhost:3000
echo - Bot Runner: Live scrapers, WhatsApp broadcast, Discord approval
echo.
pause
