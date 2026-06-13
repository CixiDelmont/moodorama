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

    // How long a mood selection stays "active" / visible on the map.  168 hours = 7 days
    'mood_ttl_hours' => 168,

    // Allowed origins for CORS. Use ['*'] to allow any (dev only).
    // Override at deploy time with CORS_ALLOWED_ORIGINS=https://tonicturtle.com,http://localhost:5173
    'cors_allowed_origins' => [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://tonicturtle.com',
    ],
];
