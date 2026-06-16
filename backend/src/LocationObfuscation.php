<?php

declare(strict_types=1);

namespace Moodorama;

/**
 * Randomly offsets coordinates so stored map positions are approximate, not exact GPS.
 */
final class LocationObfuscation
{
    /**
     * @return array{0: float, 1: float} [latitude, longitude]
     */
    public static function obfuscate(float $latitude, float $longitude, float $radiusMeters): array
    {
        if ($radiusMeters <= 0) {
            return [$latitude, $longitude];
        }

        $angle = (mt_rand() / mt_getrandmax()) * 2 * M_PI;
        // sqrt() → uniform distribution over the disk, not just the radius.
        $distance = sqrt(mt_rand() / mt_getrandmax()) * $radiusMeters;

        $metersPerDegreeLat = 111_320.0;
        $metersPerDegreeLng = $metersPerDegreeLat * cos(deg2rad($latitude));
        if (abs($metersPerDegreeLng) < 1e-6) {
            $metersPerDegreeLng = 1e-6;
        }

        $lat = $latitude + ($distance * cos($angle)) / $metersPerDegreeLat;
        $lng = $longitude + ($distance * sin($angle)) / $metersPerDegreeLng;

        $lat = max(-90.0, min(90.0, $lat));
        $lng = fmod($lng + 180.0, 360.0);
        if ($lng < 0) {
            $lng += 360.0;
        }
        $lng -= 180.0;

        return [$lat, $lng];
    }
}
