<?php

/**
 * One-off utility: rasterize Natural Earth 110m land polygons into an
 * equirectangular PNG mask (white = land, black = ocean).
 *
 *   php backend/scripts/generate_land_mask.php
 */

declare(strict_types=1);

const GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson';
const MASK_WIDTH = 720;
const MASK_HEIGHT = 360;
const OUTPUT = __DIR__ . '/data/land_mask.png';

function pointInRing(float $lat, float $lng, array $ring): bool
{
    $inside = false;
    $n = count($ring);

    for ($i = 0, $j = $n - 1; $i < $n; $j = $i++) {
        $yi = (float) $ring[$i][1];
        $xi = (float) $ring[$i][0];
        $yj = (float) $ring[$j][1];
        $xj = (float) $ring[$j][0];

        $intersects = (($yi > $lat) !== ($yj > $lat))
            && ($lng < ($xj - $xi) * ($lat - $yi) / ($yj - $yi + 1e-15) + $xi);

        if ($intersects) {
            $inside = !$inside;
        }
    }

    return $inside;
}

function pointInPolygon(float $lat, float $lng, array $rings): bool
{
    if ($rings === []) {
        return false;
    }

    if (!pointInRing($lat, $lng, $rings[0])) {
        return false;
    }

    for ($i = 1, $n = count($rings); $i < $n; $i++) {
        if (pointInRing($lat, $lng, $rings[$i])) {
            return false;
        }
    }

    return true;
}

/** @return list<list<list<array{0: float, 1: float}>>> */
function extractPolygons(array $geometry): array
{
    $type = $geometry['type'] ?? '';
    $coords = $geometry['coordinates'] ?? [];

    return match ($type) {
        'Polygon' => [$coords],
        'MultiPolygon' => $coords,
        default => [],
    };
}

if (!extension_loaded('gd')) {
    fwrite(STDERR, "PHP GD extension is required.\n");
    exit(1);
}

$json = file_get_contents(GEOJSON_URL);
if ($json === false) {
    fwrite(STDERR, "Failed to download land GeoJSON.\n");
    exit(1);
}

$data = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
$polygons = [];

foreach ($data['features'] as $feature) {
    foreach (extractPolygons($feature['geometry']) as $rings) {
        $polygons[] = $rings;
    }
}

$img = imagecreatetruecolor(MASK_WIDTH, MASK_HEIGHT);
$ocean = imagecolorallocate($img, 0, 0, 0);
$land = imagecolorallocate($img, 255, 255, 255);
imagefill($img, 0, 0, $ocean);

for ($y = 0; $y < MASK_HEIGHT; $y++) {
    $lat = 90.0 - ($y / (MASK_HEIGHT - 1)) * 180.0;

    for ($x = 0; $x < MASK_WIDTH; $x++) {
        $lng = -180.0 + ($x / (MASK_WIDTH - 1)) * 360.0;
        $onLand = false;

        foreach ($polygons as $rings) {
            if (pointInPolygon($lat, $lng, $rings)) {
                $onLand = true;
                break;
            }
        }

        if ($onLand) {
            imagesetpixel($img, $x, $y, $land);
        }
    }

    if ($y % 36 === 0) {
        $pct = (int) round($y / (MASK_HEIGHT - 1) * 100);
        fwrite(STDERR, "Rasterizing… {$pct}%\n");
    }
}

if (!is_dir(dirname(OUTPUT))) {
    mkdir(dirname(OUTPUT), 0755, true);
}

if (!imagepng($img, OUTPUT)) {
    fwrite(STDERR, "Failed to write mask.\n");
    exit(1);
}

imagedestroy($img);
echo "Wrote " . OUTPUT . " (" . MASK_WIDTH . "x" . MASK_HEIGHT . ")\n";
