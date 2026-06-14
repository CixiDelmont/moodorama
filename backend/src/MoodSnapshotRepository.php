<?php

declare(strict_types=1);

namespace Moodorama;

use PDO;

/**
 * Hourly snapshots of active moods: precise coordinates + country, no personal data.
 */
final class MoodSnapshotRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function truncateToHour(\DateTimeImmutable $when): \DateTimeImmutable
    {
        return $when->setTime((int) $when->format('H'), 0, 0);
    }

    public function hasSnapshot(\DateTimeImmutable $hour): bool
    {
        $stmt = $this->pdo->prepare(
            'SELECT 1 FROM mood_snapshots WHERE snapshot_at = :snapshot_at LIMIT 1'
        );
        $stmt->execute([':snapshot_at' => $this->truncateToHour($hour)->format('Y-m-d H:i:s')]);

        return $stmt->fetchColumn() !== false;
    }

    /**
     * Capture all currently active moods into the hourly snapshot tables.
     *
     * @return array{points: int, countries: int}
     */
    public function captureHour(
        \DateTimeImmutable $hour,
        MoodRepository $moodRepo,
        CountryLookup $lookup,
        bool $excludeSeed = true,
    ): array {
        $hour = $this->truncateToHour($hour);
        $snapshotAt = $hour->format('Y-m-d H:i:s');

        if ($this->hasSnapshot($hour)) {
            return ['points' => 0, 'countries' => 0];
        }

        $rows = $moodRepo->activeMoodCoordinates($excludeSeed);
        if ($rows === []) {
            $this->pdo->prepare(
                'INSERT INTO mood_snapshots (snapshot_at, point_count, captured_at)
                 VALUES (:snapshot_at, 0, NOW())'
            )->execute([':snapshot_at' => $snapshotAt]);

            return ['points' => 0, 'countries' => 0];
        }

        $pointStmt = $this->pdo->prepare(
            'INSERT INTO mood_snapshot_points
                (snapshot_at, mood, latitude, longitude, country_code)
             VALUES
                (:snapshot_at, :mood, :latitude, :longitude, :country_code)'
        );

        /** @var array<string, array<string, int>> $countryCounts */
        $countryCounts = [];

        $this->pdo->beginTransaction();

        try {
            foreach ($rows as $row) {
                $lat = (float) $row['latitude'];
                $lng = (float) $row['longitude'];
                $mood = (string) $row['mood'];
                $countryCode = $lookup->countryCode($lat, $lng);

                $pointStmt->execute([
                    ':snapshot_at'  => $snapshotAt,
                    ':mood'         => $mood,
                    ':latitude'     => $lat,
                    ':longitude'    => $lng,
                    ':country_code' => $countryCode,
                ]);

                $bucket = $countryCode ?? 'XX';
                $countryCounts[$bucket][$mood] = ($countryCounts[$bucket][$mood] ?? 0) + 1;
            }

            $countStmt = $this->pdo->prepare(
                'INSERT INTO mood_snapshot_country_counts
                    (snapshot_at, country_code, mood, count)
                 VALUES
                    (:snapshot_at, :country_code, :mood, :count)'
            );

            foreach ($countryCounts as $countryCode => $moods) {
                foreach ($moods as $mood => $count) {
                    $countStmt->execute([
                        ':snapshot_at'   => $snapshotAt,
                        ':country_code'  => $countryCode,
                        ':mood'          => $mood,
                        ':count'         => $count,
                    ]);
                }
            }

            $this->pdo->prepare(
                'INSERT INTO mood_snapshots (snapshot_at, point_count, captured_at)
                 VALUES (:snapshot_at, :point_count, NOW())'
            )->execute([
                ':snapshot_at' => $snapshotAt,
                ':point_count' => count($rows),
            ]);

            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }

        return [
            'points'    => count($rows),
            'countries' => count($countryCounts),
        ];
    }

    /**
     * @return list<array{snapshotAt: string, pointCount: int, capturedAt: string}>
     */
    public function listSnapshots(int $limit = 168): array
    {
        $limit = max(1, min(1000, $limit));
        $stmt = $this->pdo->query(
            "SELECT snapshot_at, point_count, captured_at
             FROM mood_snapshots
             ORDER BY snapshot_at DESC
             LIMIT {$limit}"
        );

        return array_map(static function (array $row): array {
            return [
                'snapshotAt' => $row['snapshot_at'],
                'pointCount' => (int) $row['point_count'],
                'capturedAt' => $row['captured_at'],
            ];
        }, $stmt->fetchAll());
    }

    /**
     * @return list<array{mood: string, latitude: float, longitude: float, countryCode: ?string}>
     */
    public function pointsAt(\DateTimeImmutable $hour): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT mood, latitude, longitude, country_code
             FROM mood_snapshot_points
             WHERE snapshot_at = :snapshot_at'
        );
        $stmt->execute([':snapshot_at' => $this->truncateToHour($hour)->format('Y-m-d H:i:s')]);

        return array_map(static function (array $row): array {
            $code = $row['country_code'];
            return [
                'mood'        => $row['mood'],
                'latitude'    => (float) $row['latitude'],
                'longitude'   => (float) $row['longitude'],
                'countryCode' => is_string($code) && $code !== '' ? $code : null,
            ];
        }, $stmt->fetchAll());
    }

    /**
     * @return list<array{countryCode: string, mood: string, count: int}>
     */
    public function countryBreakdownAt(\DateTimeImmutable $hour): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT country_code, mood, count
             FROM mood_snapshot_country_counts
             WHERE snapshot_at = :snapshot_at
             ORDER BY country_code, mood'
        );
        $stmt->execute([':snapshot_at' => $this->truncateToHour($hour)->format('Y-m-d H:i:s')]);

        return array_map(static function (array $row): array {
            return [
                'countryCode' => $row['country_code'],
                'mood'        => $row['mood'],
                'count'       => (int) $row['count'],
            ];
        }, $stmt->fetchAll());
    }
}
