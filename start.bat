@echo off
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
pause
