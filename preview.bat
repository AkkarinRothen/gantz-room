@echo off
title GANTZ WEB // PREVISUALIZACION LOCAL
cls
echo ========================================================
echo        ⚫ INICIANDO PREVISUALIZACION GANTZ WEB ⚫
echo ========================================================
echo.

cd /d "%~dp0"
node preview-server.js
pause
