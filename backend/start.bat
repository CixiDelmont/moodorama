@echo off
cd /d "%~dp0"
for /f "delims=" %%i in ('where php 2^>nul') do (
    if exist "%%~dpiextras\ssl\openssl.cnf" set "OPENSSL_CONF=%%~dpiextras\ssl\openssl.cnf"
)
echo Starting Moodorama API at http://localhost:8000/api
php -S localhost:8000 -t public public/router.php
