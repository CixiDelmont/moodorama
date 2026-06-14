<?php

/**
 * Minimal PSR-4 style autoloader for the Moodorama\ namespace -> src/ directory.
 * Avoids a Composer dependency for such a small project.
 */

require __DIR__ . '/OpenSslConfig.php';
Moodorama\OpenSslConfig::ensureCliEnvironment($_SERVER['argv'] ?? []);

$vendorAutoload = dirname(__DIR__) . '/vendor/autoload.php';
if (is_file($vendorAutoload)) {
    require $vendorAutoload;
}

spl_autoload_register(static function (string $class): void {
    $prefix = 'Moodorama\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file = __DIR__ . '/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require $file;
    }
});
