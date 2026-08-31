@echo off
cd /d "%~dp0"
python server.py
if errorlevel 1 (
  echo.
  echo Une erreur s'est produite. Verifiez que Python est installe et accessible ^(commande "python"^).
  pause
)
