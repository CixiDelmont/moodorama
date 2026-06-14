<?php



namespace Moodorama;



use PDO;



/**

 * Data access for the `moods` table.

 */

final class MoodRepository

{

    public const MOODS = ['joy', 'fear', 'sadness', 'disgust', 'anger'];

    public const ALIAS_MAX_LENGTH = 32;



    public function __construct(private PDO $pdo)

    {

    }



    /**

     * Insert a new mood for the user, or update the existing one.

     * Resets the 7d (configurable) expiry window each time.

     */

    public function upsert(string $userId, string $mood, float $lat, float $lng, ?string $alias = null): array

    {

        $ttl = (int) Config::get('mood_ttl_hours', 168); // 168 hours = 7 days

        $now = new \DateTimeImmutable('now');

        $expires = $now->add(new \DateInterval('PT' . $ttl . 'H'));



        $nowStr = $now->format('Y-m-d H:i:s');

        $expiresStr = $expires->format('Y-m-d H:i:s');



        $sql = 'INSERT INTO moods (user_id, mood, alias, latitude, longitude, created_at, updated_at, expires_at)

                VALUES (:user_id, :mood, :alias, :lat, :lng, :created_at, :updated_at, :expires_at)

                ON DUPLICATE KEY UPDATE

                    mood       = VALUES(mood),

                    alias      = VALUES(alias),

                    latitude   = VALUES(latitude),

                    longitude  = VALUES(longitude),

                    updated_at = VALUES(updated_at),

                    expires_at = VALUES(expires_at),

                    push_notified_at = NULL';



        $stmt = $this->pdo->prepare($sql);

        $stmt->execute([

            ':user_id'    => $userId,

            ':mood'       => $mood,

            ':alias'      => $alias,

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

     *

     * @param bool $excludeSeed When true, omit rows whose user_id starts with "seed-".

     */

    public function activeMoods(bool $excludeSeed = false): array

    {

        $sql = 'SELECT id, mood, alias, latitude, longitude, updated_at, expires_at

                FROM moods

                WHERE expires_at > NOW()';

        if ($excludeSeed) {

            $sql .= " AND user_id NOT LIKE 'seed-%'";

        }

        $rows = $this->pdo->query($sql)->fetchAll();



        return array_map(fn (array $r): array => $this->mapMoodRow($r), $rows);

    }



    /**

     * Active moods expiring within the reminder window that have push subscriptions

     * and have not yet been notified for the current expiry cycle.

     *

     * @return list<array<string, mixed>>

     */

    public function findExpiringForPush(int $reminderHours): array

    {

        $sql = 'SELECT m.user_id, m.mood, m.expires_at,

                       ps.id AS subscription_id, ps.endpoint, ps.p256dh, ps.auth

                FROM moods m

                INNER JOIN push_subscriptions ps ON ps.user_id = m.user_id

                WHERE m.expires_at > NOW()

                  AND m.expires_at <= DATE_ADD(NOW(), INTERVAL :hours HOUR)

                  AND m.user_id NOT LIKE \'seed-%\'

                  AND m.push_notified_at IS NULL';

        $stmt = $this->pdo->prepare($sql);

        $stmt->execute([':hours' => max(1, $reminderHours)]);

        return $stmt->fetchAll();

    }



    public function markPushNotified(string $userId): void

    {

        $stmt = $this->pdo->prepare(

            'UPDATE moods SET push_notified_at = NOW() WHERE user_id = :user_id'

        );

        $stmt->execute([':user_id' => $userId]);

    }



    public function findByUser(string $userId): ?array

    {

        $stmt = $this->pdo->prepare(

            'SELECT id, user_id, mood, alias, latitude, longitude, updated_at, expires_at

             FROM moods WHERE user_id = :user_id'

        );

        $stmt->execute([':user_id' => $userId]);

        $row = $stmt->fetch();



        if ($row === false) {

            return null;

        }



        $active = strtotime($row['expires_at']) > time();



        return [

            ...$this->mapMoodRow($row),

            'userId' => $row['user_id'],

            'active' => $active,

        ];

    }



  /** @param array<string, mixed> $row */

    private function mapMoodRow(array $row): array

    {

        $mapped = [

            'id'        => (int) $row['id'],

            'mood'      => $row['mood'],

            'latitude'  => (float) $row['latitude'],

            'longitude' => (float) $row['longitude'],

            'updatedAt' => $row['updated_at'],

            'expiresAt' => $row['expires_at'],

        ];



        $alias = isset($row['alias']) ? trim((string) $row['alias']) : '';

        if ($alias !== '') {

            $mapped['alias'] = $alias;

        }



        return $mapped;

    }



    /** Absolute URL to the push notification icon for a mood. */
    public static function pushIconUrl(string $mood, string $iconBaseUrl, string $extension = 'png'): string
    {
        if (!in_array($mood, self::MOODS, true)) {
            $mood = 'joy';
        }

        return rtrim($iconBaseUrl, '/') . '/' . $mood . '.' . ltrim($extension, '.');
    }



    public static function normalizeAlias(mixed $value): ?string

    {

        if ($value === null || !is_string($value)) {

            return null;

        }



        $alias = trim($value);

        if ($alias === '') {

            return null;

        }



        if (mb_strlen($alias) > self::ALIAS_MAX_LENGTH) {

            throw new \InvalidArgumentException(

                'alias must be at most ' . self::ALIAS_MAX_LENGTH . ' characters'

            );

        }



        if (!preg_match('/^[\p{L}\p{N}][\p{L}\p{N} ._\-\'’]{0,31}$/u', $alias)) {

            throw new \InvalidArgumentException(

                'alias may only contain letters, numbers, spaces, and . _ - \''

            );

        }



        return $alias;

    }

}


