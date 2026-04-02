@echo off
setlocal
echo ==========================================
echo    ShipmentSure — External Sharing Tool
echo ==========================================

:: Check if backend is running
netstat -ano | findstr :8000 > nul
if errorlevel 1 (
    echo [WARNING] Backend (port 8000) not detected! 
    echo Please start the FastAPI server first.
    pause
    exit /b
)

:: Check if frontend is running
netstat -ano | findstr :3000 > nul
if errorlevel 1 (
    echo [WARNING] Frontend (port 3000) not detected! 
    echo Please start the Vite dev server ("npm run dev") first.
    pause
    exit /b
)

echo.
echo [INFO] Detected local servers. Launching Ngrok tunnel...
echo [INFO] Your friend will see the ShipmentSure app at the URL below.
echo.

:: Start ngrok on port 3000 (Vite)
:: Note: Vite's proxy handles the API calls to 8000 correctly via the same URL.
ngrok http 3000

endlocal
