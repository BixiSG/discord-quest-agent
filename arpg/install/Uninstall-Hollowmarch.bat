@echo off
title Hollowmarch - Uninstall
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Hollowmarch.ps1" -Uninstall %*
echo.
pause
