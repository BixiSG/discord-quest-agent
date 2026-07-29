@echo off
title Discord Quest Agent - Uninstall
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Uninstall.ps1"
echo.
pause
