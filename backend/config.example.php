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

    // Hourly mood snapshots (php backend/scripts/snapshot_moods.php)
    'snapshot_exclude_seed' => true,

    // Web Push (generate keys with: php backend/scripts/generate_vapid_keys.php)
    'vapid_public_key'  => 'BPOzlk_b4xSHUngAO0paFrdFW7KGAv-qBd9dd_Q1v8F8R5s1k_DkFjF5yFJhXLj4wtdTG8n5cGIlCtZIfQ28KaA',
    'vapid_private_key' => 'JTkNsn0vzshYToIB5hHAb6q3_UEii-bmNnF5gCN45Ko',
    'vapid_subject'     => 'mailto:moodorama@tonicturtle.com',
    // Hours before expiry to send a push reminder (matches in-app reminder window).
    'push_reminder_hours' => 24,
    'push_app_url'  => getenv('PUSH_APP_URL') ?: 'https://tonicturtle.com/moodorama/',
    // Base URL for mood icons, e.g. https://tonicturtle.com/moodorama/moods/
    'push_icon_base_url' => getenv('PUSH_ICON_BASE_URL') ?: 'https://tonicturtle.com/moodorama/moods/',
    'push_icon_extension' => getenv('PUSH_ICON_EXTENSION') ?: 'png',

    // Allowed origins for CORS. Use ['*'] to allow any (dev only).
    // Override at deploy time with CORS_ALLOWED_ORIGINS=https://tonicturtle.com,http://localhost:5173
    'cors_allowed_origins' => [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://tonicturtle.com',
    ],
];
