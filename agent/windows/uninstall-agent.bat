@echo off
cd /d "%~dp0"
title Copot PC Monitor Agent
echo ===================================================
echo       Pemberhentian / Copot PC Monitor Agent
echo ===================================================
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0uninstall-agent-task.ps1"
echo.
echo Selesai. Tekan tombol apa saja untuk keluar...
pause >nul

