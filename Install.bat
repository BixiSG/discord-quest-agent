@echo off
title Discord Quest Agent - Install
rem Runs the installer with the execution policy relaxed for this process only.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Install.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed. See the message above.
)
echo.
pause
