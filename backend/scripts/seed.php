<?php

/**
 * Seeds the database with random active moods around the world so the map
 * has something to show during development. Points are rejected until they
 * fall on land (see scripts/data/land_mask.png).
 *
 *   php backend/scripts/seed.php [count]
 *
 * Default count is 800. Seeded rows expire like normal moods (7d).
 *
 * Regenerate the land mask with:
 *   php backend/scripts/generate_land_mask.php
 */

declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';

use Moodorama\Database;
use Moodorama\MoodRepository;

$count = isset($argv[1]) ? max(1, (int) $argv[1]) : 800;
$maskPath = __DIR__ . '/data/land_mask.png';

if (!is_file($maskPath)) {
    fwrite(STDERR, "Land mask not found at {$maskPath}\n");
    fwrite(STDERR, "Run: php backend/scripts/generate_land_mask.php\n");
    exit(1);
}

if (!extension_loaded('gd')) {
    fwrite(STDERR, "PHP GD extension is required to read the land mask.\n");
    exit(1);
}

$mask = imagecreatefrompng($maskPath);
if ($mask === false) {
    fwrite(STDERR, "Failed to load land mask.\n");
    exit(1);
}

$maskW = imagesx($mask);
$maskH = imagesy($mask);

$pdo = Database::connection();
$repo = new MoodRepository($pdo);

// A handful of population clusters so the heatmap looks realistic, plus
// fully random points scattered across the globe.
$clusters = [
    ['name' => 'Europe',        'lat' => 50.0,   'lng' => 10.0,   'spread' => 12.0],
    ['name' => 'North America', 'lat' => 39.0,   'lng' => -98.0,  'spread' => 16.0],
    ['name' => 'South America', 'lat' => -15.0,  'lng' => -60.0,  'spread' => 14.0],
    ['name' => 'East Asia',     'lat' => 34.0,   'lng' => 113.0,  'spread' => 12.0],
    ['name' => 'South Asia',    'lat' => 22.0,   'lng' => 78.0,   'spread' => 10.0],
    ['name' => 'Africa',        'lat' => 2.0,    'lng' => 20.0,   'spread' => 18.0],
    ['name' => 'Oceania',       'lat' => -28.0,  'lng' => 140.0,  'spread' => 12.0],
];

$moods = MoodRepository::MOODS;

function clamp(float $v, float $min, float $max): float
{
    return max($min, min($max, $v));
}

function gauss(float $mean, float $stddev): float
{
    // Box-Muller transform.
    $u1 = mt_rand() / mt_getrandmax();
    $u2 = mt_rand() / mt_getrandmax();
    $z = sqrt(-2.0 * log($u1 + 1e-12)) * cos(2 * M_PI * $u2);

    return $mean + $z * $stddev;
}

function isLand(float $lat, float $lng, \GdImage $mask, int $maskW, int $maskH): bool
{
    $x = (int) round(($lng + 180.0) / 360.0 * ($maskW - 1));
    $y = (int) round((90.0 - $lat) / 180.0 * ($maskH - 1));
    $x = max(0, min($maskW - 1, $x));
    $y = max(0, min($maskH - 1, $y));

    $rgb = imagecolorat($mask, $x, $y);
    $r = ($rgb >> 16) & 0xFF;

    return $r > 128;
}

function randomLandCoords(array $clusters, \GdImage $mask, int $maskW, int $maskH): array
{
    $maxAttempts = 200;

    for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
        if (mt_rand(0, 100) < 80) {
            $c = $clusters[array_rand($clusters)];
            $lat = clamp(gauss($c['lat'], $c['spread'] / 2), -85, 85);
            $lng = clamp(gauss($c['lng'], $c['spread'] / 2), -179, 179);
        } else {
            $lat = mt_rand(-8000, 8000) / 100.0;
            $lng = mt_rand(-18000, 18000) / 100.0;
        }

        if (isLand($lat, $lng, $mask, $maskW, $maskH)) {
            return [$lat, $lng];
        }
    }

    throw new \RuntimeException('Could not find a land coordinate after ' . $maxAttempts . ' attempts.');
}

$pdo->beginTransaction();
$inserted = 0;

for ($i = 0; $i < $count; $i++) {
    [$lat, $lng] = randomLandCoords($clusters, $mask, $maskW, $maskH);

    $mood = $moods[array_rand($moods)];
    $userId = sprintf('seed-%s', bin2hex(random_bytes(8)));

    $repo->upsert($userId, $mood, $lat, $lng);
    $inserted++;
}

$pdo->commit();
imagedestroy($mask);

echo "Seeded $inserted random moods on land.\n";
