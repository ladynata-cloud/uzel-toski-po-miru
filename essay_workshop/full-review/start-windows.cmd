@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 goto python
py -3 full_review_server.py --html essay-check.html --open
goto finish
:python
where python >nul 2>nul
if errorlevel 1 goto missing
python full_review_server.py --html essay-check.html --open
goto finish
:missing
echo Install Python 3 from https://www.python.org/downloads/windows/ and open this file again.
:finish
if errorlevel 1 pause
