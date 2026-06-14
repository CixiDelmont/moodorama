@echo off
cd /d "%~dp0"
php composer.phar install --no-interaction --ignore-platform-req=ext-curl
if errorlevel 1 exit /b 1
echo Dependencies installed.
