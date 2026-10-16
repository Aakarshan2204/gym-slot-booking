@echo off
cd /d "%~dp0"
title PULSE GYM Booking Server
cls
echo ============================================================
echo   PULSE GYM - Online Session Booking System
echo ============================================================
echo.
echo Initializing database, scheduling sessions, and starting server...
echo The browser will open automatically once the server is ready.
echo (Keep this window open while using the website)
echo.
py -3 server.py || python server.py
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [ERROR] Could not start server! Please check that Python is installed and in PATH.
  echo.
)
pause
