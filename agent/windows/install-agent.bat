@echo off
cd /d "%~dp0"
title Pasang PC Monitor Agent
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0install-agent-task.ps1"
pause

