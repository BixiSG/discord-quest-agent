@echo off
title Hollowmarch - Install
rem Runs the installer with the execution policy relaxed for this process only.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Hollowmarch.ps1" %*
echo.
pause
