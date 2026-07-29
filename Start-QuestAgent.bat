@echo off
title Discord Quest Agent
rem Run the agent in this window so you can read its log. Close the window to stop it.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0src\QuestAgent.ps1" %*
echo.
pause
