@echo off
title KSA Jobs - Standalone Gmail CV Scanner
color 0B
echo ========================================================
echo   KSA JOBS - GMAIL CANDIDATE CV INGESTION SCANNER
echo ========================================================
echo.
echo [1] Scan Unread Candidate CV Emails
echo [2] Deep Historical Scan (All Past Emails in Inbox)
echo.
set /p choice="Select an option [1 or 2]: "

if "%choice%"=="2" (
    echo.
    echo Running deep scan of Gmail inbox...
    pnpm --filter @ksajobs/bot exec tsx src/cli/scan-gmail.ts --all --limit 100
) else (
    echo.
    echo Scanning unread candidate CV emails...
    pnpm --filter @ksajobs/bot exec tsx src/cli/scan-gmail.ts
)

echo.
echo Done! Candidate CVs are now available on the Web Portal:
echo http://localhost:3000/admin/candidates
echo.
pause
