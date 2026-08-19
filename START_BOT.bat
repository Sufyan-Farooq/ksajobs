@echo off
title KSA JOBS - Autonomous Bot Service
color 0B
echo ============================================================
echo           KSA JOBS - AUTONOMOUS BOT SERVICE
echo ============================================================
echo.
echo Starting Scrapers, WhatsApp Broadcaster, Discord Moderation, and CV Inbox Poller...
echo.
cd /d %~dp0\services\bot
pnpm start
pause
