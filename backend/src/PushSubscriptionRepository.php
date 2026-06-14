<?php

namespace Moodorama;

use PDO;

/** Data access for browser push subscriptions. */
final class PushSubscriptionRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** @param array{endpoint: string, keys: array{p256dh: string, auth: string}} $subscription */
    public function upsert(string $userId, array $subscription): void
    {
        $endpoint = trim($subscription['endpoint'] ?? '');
        $p256dh = trim($subscription['keys']['p256dh'] ?? '');
        $auth = trim($subscription['keys']['auth'] ?? '');

        if ($endpoint === '' || $p256dh === '' || $auth === '') {
            throw new \InvalidArgumentException('subscription endpoint and keys are required');
        }

        $now = (new \DateTimeImmutable('now'))->format('Y-m-d H:i:s');

        $sql = 'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at, updated_at)
                VALUES (:user_id, :endpoint, :p256dh, :auth, :created_at, :updated_at)
                ON DUPLICATE KEY UPDATE
                    user_id    = VALUES(user_id),
                    p256dh     = VALUES(p256dh),
                    auth       = VALUES(auth),
                    updated_at = VALUES(updated_at)';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':user_id'    => $userId,
            ':endpoint'   => $endpoint,
            ':p256dh'     => $p256dh,
            ':auth'       => $auth,
            ':created_at' => $now,
            ':updated_at' => $now,
        ]);
    }

    public function deleteByEndpoint(string $userId, string $endpoint): bool
    {
        $stmt = $this->pdo->prepare(
            'DELETE FROM push_subscriptions WHERE user_id = :user_id AND endpoint = :endpoint'
        );
        $stmt->execute([
            ':user_id'  => $userId,
            ':endpoint' => trim($endpoint),
        ]);

        return $stmt->rowCount() > 0;
    }

    public function deleteById(int $id): void
    {
        $stmt = $this->pdo->prepare('DELETE FROM push_subscriptions WHERE id = :id');
        $stmt->execute([':id' => $id]);
    }
}
