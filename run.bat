@echo off
echo Starting MindCraft-CE...
call npm run gui
if %ERRORLEVEL% neq 0 (
    echo Error starting application
    pause
    exit /b %ERRORLEVEL%
)