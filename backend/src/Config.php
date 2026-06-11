<?php

namespace Moodorama;

/**
 * Loads configuration from config.php (falling back to config.example.php).
 */
final class Config
{
    private static ?array $data = null;

    public static function all(): array
    {
        if (self::$data === null) {
            $base = dirname(__DIR__);
            $file = $base . '/config.php';
            if (!is_file($file)) {
                $file = $base . '/config.example.php';
            }
            self::$data = require $file;
        }

        return self::$data;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        if ($key === 'cors_allowed_origins') {
            $env = getenv('CORS_ALLOWED_ORIGINS');
            if (is_string($env) && $env !== '') {
                return array_values(array_filter(array_map('trim', explode(',', $env))));
            }
        }

        return self::all()[$key] ?? $default;
    }
}
