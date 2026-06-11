<?php
/**
 * Copy this file to `config.php` and adjust for your environment.
 * `config.php` is git-ignored so your credentials stay local.
 *
 * Environment variables (if set) take precedence over these values, which
 * makes it easy to deploy without editing the file.
 */

return [
    'db' => [
        'host'     => getenv('DB_HOST') ?: '127.0.0.1',
        'port'     => getenv('DB_PORT') ?: '3306',
        'database' => getenv('DB_NAME') ?: 'moodorama',
        'username' => getenv('DB_USER') ?: 'root',
        'password' => getenv('DB_PASS') !== false ? getenv('DB_PASS') : '',
        'charset'  => 'utf8mb4',
    ],

    // How long a mood selection stays "active" / visible on the map.
    'mood_ttl_hours' => 12,

    // Allowed origins for CORS. Use ['*'] to allow any (dev only).
    'cors_allowed_origins' => ['http://localhost:5173', 'http://127.0.0.1:5173'],
];
