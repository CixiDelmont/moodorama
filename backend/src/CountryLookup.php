<?php

declare(strict_types=1);

namespace Moodorama;

/**
 * Offline reverse geocoding: latitude/longitude → ISO 3166-1 alpha-2 country code.
 *
 * Uses Natural Earth admin-0 polygons. Data is cached locally under backend/data/
 * and downloaded on first use if missing.
 */
final class CountryLookup
{
    private const GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

    /** @var list<array{code: string, minLat: float, maxLat: float, minLng: float, maxLng: float, rings: list<list<list<array{0: float, 1: float}>>>}> */
    private array $countries = [];

    public function __construct(?string $geoJsonPath = null)
    {
        $path = $geoJsonPath ?? dirname(__DIR__) . '/data/ne_50m_admin_0_countries.geojson';
        $json = $this->readGeoJson($path);
        $data = json_decode($json, true, flags: JSON_THROW_ON_ERROR);

        foreach ($data['features'] as $feature) {
            $code = $this->isoCode($feature['properties'] ?? []);
            if ($code === null) {
                continue;
            }

            foreach ($this->extractPolygons($feature['geometry'] ?? []) as $rings) {
                $bounds = $this->boundsForRings($rings);
                if ($bounds === null) {
                    continue;
                }

                $this->countries[] = [
                    'code'   => $code,
                    'minLat' => $bounds['minLat'],
                    'maxLat' => $bounds['maxLat'],
                    'minLng' => $bounds['minLng'],
                    'maxLng' => $bounds['maxLng'],
                    'rings'  => $rings,
                ];
            }
        }
    }

    /** Resolve ISO alpha-2 code, or null for ocean / unknown. */
    public function countryCode(float $lat, float $lng): ?string
    {
        foreach ($this->countries as $country) {
            if ($lat < $country['minLat'] || $lat > $country['maxLat']) {
                continue;
            }
            if ($lng < $country['minLng'] || $lng > $country['maxLng']) {
                continue;
            }
            if ($this->pointInPolygon($lat, $lng, $country['rings'])) {
                return $country['code'];
            }
        }

        return null;
    }

    private function readGeoJson(string $path): string
    {
        if (is_readable($path)) {
            $json = file_get_contents($path);
            if ($json !== false) {
                return $json;
            }
        }

        $json = file_get_contents(self::GEOJSON_URL);
        if ($json === false) {
            throw new \RuntimeException('Failed to download country boundaries GeoJSON.');
        }

        $dir = dirname($path);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        if (file_put_contents($path, $json) === false) {
            throw new \RuntimeException('Failed to cache country boundaries at ' . $path);
        }

        return $json;
    }

    /** @param array<string, mixed> $props */
    private function isoCode(array $props): ?string
    {
        foreach (['ISO_A2_EH', 'ISO_A2', 'WB_A2'] as $key) {
            $code = $props[$key] ?? null;
            if (!is_string($code)) {
                continue;
            }
            $code = strtoupper(trim($code));
            if ($code !== '' && $code !== '-99') {
                return $code;
            }
        }

        return null;
    }

    /** @return list<list<list<array{0: float, 1: float}>>> */
    private function extractPolygons(array $geometry): array
    {
        $type = $geometry['type'] ?? '';
        $coords = $geometry['coordinates'] ?? [];

        return match ($type) {
            'Polygon' => [$coords],
            'MultiPolygon' => $coords,
            default => [],
        };
    }

    /**
     * @param list<list<array{0: float, 1: float}>> $rings
     * @return array{minLat: float, maxLat: float, minLng: float, maxLng: float}|null
     */
    private function boundsForRings(array $rings): ?array
    {
        if ($rings === []) {
            return null;
        }

        $minLat = 90.0;
        $maxLat = -90.0;
        $minLng = 180.0;
        $maxLng = -180.0;

        foreach ($rings as $ring) {
            foreach ($ring as $coord) {
                $lng = (float) $coord[0];
                $lat = (float) $coord[1];
                $minLat = min($minLat, $lat);
                $maxLat = max($maxLat, $lat);
                $minLng = min($minLng, $lng);
                $maxLng = max($maxLng, $lng);
            }
        }

        return [
            'minLat' => $minLat,
            'maxLat' => $maxLat,
            'minLng' => $minLng,
            'maxLng' => $maxLng,
        ];
    }

    /** @param list<list<array{0: float, 1: float}>> $rings */
    private function pointInPolygon(float $lat, float $lng, array $rings): bool
    {
        if ($rings === []) {
            return false;
        }

        if (!$this->pointInRing($lat, $lng, $rings[0])) {
            return false;
        }

        for ($i = 1, $n = count($rings); $i < $n; $i++) {
            if ($this->pointInRing($lat, $lng, $rings[$i])) {
                return false;
            }
        }

        return true;
    }

    /** @param list<array{0: float, 1: float}> $ring */
    private function pointInRing(float $lat, float $lng, array $ring): bool
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
}
