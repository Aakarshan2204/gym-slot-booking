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
start "" "http://localhost:8000"
python server.py
pause
