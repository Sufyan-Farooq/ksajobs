@echo off
title KSA JOBS - Web Portal
color 0E
echo ============================================================
echo           KSA JOBS - NEXT.JS WEB PORTAL
echo ============================================================
echo.
echo Starting Web Portal on http://localhost:3000...
echo.
cd /d %~dp0\apps\web
pnpm start
pause
