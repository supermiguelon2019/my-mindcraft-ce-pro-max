echo Installing dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo Error installing dependencies
    pause
    exit /b %ERRORLEVEL%
)
echo Dependencies installed successfully!
pause
