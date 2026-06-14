<?php

/**
 * Captures an hourly snapshot of all active moods for historical analysis.
 * Run hourly via cron / Task Scheduler:
 *
 *   0 * * * * php /path/to/backend/scripts/snapshot_moods.php
 */

declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';

use Moodorama\Config;
use Moodorama\CountryLookup;
use Moodorama\Database;
use Moodorama\MoodRepository;
use Moodorama\MoodSnapshotRepository;

$excludeSeed = (bool) Config::get('snapshot_exclude_seed', true);

$pdo = Database::connection();
$moodRepo = new MoodRepository($pdo);
$snapshotRepo = new MoodSnapshotRepository($pdo);
$lookup = new CountryLookup();

$hour = $snapshotRepo->truncateToHour(new \DateTimeImmutable('now'));

if ($snapshotRepo->hasSnapshot($hour)) {
    echo sprintf("Snapshot %s already exists; skipping.\n", $hour->format('Y-m-d H:i:s'));
    exit(0);
}

$result = $snapshotRepo->captureHour($hour, $moodRepo, $lookup, $excludeSeed);

echo sprintf(
    "Snapshot %s: %d points across %d countries.\n",
    $hour->format('Y-m-d H:i:s'),
    $result['points'],
    $result['countries']
);
