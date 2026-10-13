@echo off
title PULSE GYM Booking Server
cls
echo ============================================================
echo   PULSE GYM - Online Session Booking System
echo ============================================================
echo.
echo Starting server on http://localhost:8000 ...
echo (Keep this window open while using the website)
echo.
timeout /t 1 /nobreak >nul
start "" "http://localhost:8000"
py -3 server.py 2>nul || python server.py
pause
