<?php

namespace Moodorama;

use PDO;

/**
 * Data access for the `moods` table.
 */
final class MoodRepository
{
    public const MOODS = ['joy', 'fear', 'sadness', 'disgust', 'anger'];

    public function __construct(private PDO $pdo)
    {
    }

    /**
     * Insert a new mood for the user, or update the existing one.
     * Resets the 12h (configurable) expiry window each time.
     */
    public function upsert(string $userId, string $mood, float $lat, float $lng): array
    {
        $ttl = (int) Config::get('mood_ttl_hours', 12);
        $now = new \DateTimeImmutable('now');
        $expires = $now->add(new \DateInterval('PT' . $ttl . 'H'));

        $nowStr = $now->format('Y-m-d H:i:s');
        $expiresStr = $expires->format('Y-m-d H:i:s');

        $sql = 'INSERT INTO moods (user_id, mood, latitude, longitude, created_at, updated_at, expires_at)
                VALUES (:user_id, :mood, :lat, :lng, :created_at, :updated_at, :expires_at)
                ON DUPLICATE KEY UPDATE
                    mood       = VALUES(mood),
                    latitude   = VALUES(latitude),
                    longitude  = VALUES(longitude),
                    updated_at = VALUES(updated_at),
                    expires_at = VALUES(expires_at)';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':user_id'    => $userId,
            ':mood'       => $mood,
            ':lat'        => $lat,
            ':lng'        => $lng,
            ':created_at' => $nowStr,
            ':updated_at' => $nowStr,
            ':expires_at' => $expiresStr,
        ]);

        return $this->findByUser($userId) ?? [];
    }

    /**
     * All moods that are still active (not expired). These power the heatmap.
     */
    public function activeMoods(): array
    {
        $sql = 'SELECT mood, latitude, longitude, updated_at, expires_at
                FROM moods
                WHERE expires_at > NOW()';
        $rows = $this->pdo->query($sql)->fetchAll();

        return array_map(static function (array $r): array {
            return [
                'mood'      => $r['mood'],
                'latitude'  => (float) $r['latitude'],
                'longitude' => (float) $r['longitude'],
                'updatedAt' => $r['updated_at'],
                'expiresAt' => $r['expires_at'],
            ];
        }, $rows);
    }

    public function findByUser(string $userId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT user_id, mood, latitude, longitude, updated_at, expires_at
             FROM moods WHERE user_id = :user_id'
        );
        $stmt->execute([':user_id' => $userId]);
        $row = $stmt->fetch();

        if ($row === false) {
            return null;
        }

        $active = strtotime($row['expires_at']) > time();

        return [
            'userId'    => $row['user_id'],
            'mood'      => $row['mood'],
            'latitude'  => (float) $row['latitude'],
            'longitude' => (float) $row['longitude'],
            'updatedAt' => $row['updated_at'],
            'expiresAt' => $row['expires_at'],
            'active'    => $active,
        ];
    }
}
