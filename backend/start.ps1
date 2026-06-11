Set-Location $PSScriptRoot
Write-Host "Starting Moodorama API at http://localhost:8000/api"
php -S localhost:8000 -t public public/router.php
