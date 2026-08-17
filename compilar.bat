@echo off
rem Compila los instaladores de escritorio (NSIS + MSI). Doble clic y listo.
rem Es un atajo a "npm run escritorio-build".
cd /d "%~dp0"
call npm run escritorio-build
echo.
echo Listo. Instaladores en src-tauri\target\release\bundle\nsis\ y \msi\
pause
