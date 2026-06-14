<?php

/**
 * Creates the `moodorama` database and `moods` table using the configured
 * MySQL credentials. Run once before starting the API:
 *
 *   php backend/scripts/init_db.php
 */

declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';

use Moodorama\Config;

$db = Config::get('db');

// Connect to the server WITHOUT selecting a database so we can create it.
$dsn = sprintf('mysql:host=%s;port=%s;charset=%s', $db['host'], $db['port'], $db['charset']);

try {
    $pdo = new PDO($dsn, $db['username'], $db['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
} catch (PDOException $e) {
    fwrite(STDERR, "Could not connect to MySQL: {$e->getMessage()}\n");
    exit(1);
}

$name = $db['database'];

$pdo->exec("CREATE DATABASE IF NOT EXISTS `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$pdo->exec("USE `$name`");
$pdo->exec(
    "CREATE TABLE IF NOT EXISTS moods (
        id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id     CHAR(36)        NOT NULL,
        mood        ENUM('joy', 'fear', 'sadness', 'disgust', 'anger') NOT NULL,
        alias       VARCHAR(32)     NULL,
        latitude    DOUBLE          NOT NULL,
        longitude   DOUBLE          NOT NULL,
        created_at  DATETIME        NOT NULL,
        updated_at  DATETIME        NOT NULL,
        expires_at  DATETIME        NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_user (user_id),
        KEY idx_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

$hasAlias = $pdo->query("SHOW COLUMNS FROM moods LIKE 'alias'")->fetch();
if ($hasAlias === false) {
    $pdo->exec('ALTER TABLE moods ADD COLUMN alias VARCHAR(32) NULL DEFAULT NULL AFTER mood');
    echo "Added alias column to moods.\n";
}

$hasPushNotified = $pdo->query("SHOW COLUMNS FROM moods LIKE 'push_notified_at'")->fetch();
if ($hasPushNotified === false) {
    $pdo->exec('ALTER TABLE moods ADD COLUMN push_notified_at DATETIME NULL DEFAULT NULL AFTER expires_at');
    echo "Added push_notified_at column to moods.\n";
}

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS push_subscriptions (
        id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id      CHAR(36)        NOT NULL,
        endpoint     VARCHAR(512)    NOT NULL,
        p256dh       VARCHAR(255)    NOT NULL,
        auth         VARCHAR(255)    NOT NULL,
        created_at   DATETIME        NOT NULL,
        updated_at   DATETIME        NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_endpoint (endpoint(255)),
        KEY idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS mood_snapshots (
        snapshot_at  DATETIME        NOT NULL,
        point_count  INT UNSIGNED    NOT NULL,
        captured_at  DATETIME        NOT NULL,
        PRIMARY KEY (snapshot_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS mood_snapshot_points (
        id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        snapshot_at   DATETIME        NOT NULL,
        mood          ENUM('joy', 'fear', 'sadness', 'disgust', 'anger') NOT NULL,
        latitude      DOUBLE          NOT NULL,
        longitude     DOUBLE          NOT NULL,
        country_code  CHAR(2)         NULL,
        PRIMARY KEY (id),
        KEY idx_snapshot (snapshot_at),
        KEY idx_snapshot_country (snapshot_at, country_code),
        KEY idx_snapshot_mood (snapshot_at, mood)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS mood_snapshot_country_counts (
        snapshot_at   DATETIME NOT NULL,
        country_code  CHAR(2)  NOT NULL,
        mood          ENUM('joy', 'fear', 'sadness', 'disgust', 'anger') NOT NULL,
        count         INT UNSIGNED NOT NULL,
        PRIMARY KEY (snapshot_at, country_code, mood)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

echo "Database '$name' and tables are ready.\n";
