@echo off
title Discord Quest Agent - Uninstall
rem Leave the install folder before anything else: a process whose working
rem directory is inside the folder would keep Windows from deleting it.
set "DQA_SCRIPT=%~dp0scripts\Uninstall.ps1"
cd /d "%TEMP%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%DQA_SCRIPT%" %*
echo.
pause
