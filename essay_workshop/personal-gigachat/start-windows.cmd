@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 goto python
py -3 server.py --port 8765 --open
goto end
:python
python server.py --port 8765 --open
:end
pause
