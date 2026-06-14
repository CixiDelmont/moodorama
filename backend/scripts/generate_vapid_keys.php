<?php

/**
 * Generate VAPID keys for Web Push and print them for config.php.
 *
 *   php backend/scripts/generate_vapid_keys.php
 */

declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';

use Minishlink\WebPush\VAPID;

$keys = VAPID::createVapidKeys();
if ($keys === false) {
    fwrite(STDERR, "Could not generate VAPID keys. Ensure the OpenSSL extension is enabled.\n");
    exit(1);
}

echo "Add these to backend/config.php:\n\n";
echo "    'vapid_public_key'  => '" . $keys['publicKey'] . "',\n";
echo "    'vapid_private_key' => '" . $keys['privateKey'] . "',\n";
echo "    'vapid_subject'     => 'mailto:you@example.com',\n\n";
echo "Also set push_app_url to your deployed frontend URL (e.g. https://tonicturtle.com/moodorama/).\n";
