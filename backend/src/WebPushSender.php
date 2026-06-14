<?php

namespace Moodorama;

use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

/** Sends Web Push notifications using configured VAPID keys. */
final class WebPushSender
{
    private WebPush $webPush;

    public function __construct()
    {
        $publicKey = trim((string) Config::get('vapid_public_key', ''));
        $privateKey = trim((string) Config::get('vapid_private_key', ''));
        $subject = trim((string) Config::get('vapid_subject', ''));

        if ($publicKey === '' || $privateKey === '' || $subject === '') {
            throw new \RuntimeException(
                'Web Push is not configured. Set vapid_public_key, vapid_private_key, and vapid_subject in config.php'
            );
        }

        $this->webPush = new WebPush([
            'VAPID' => [
                'subject'    => $subject,
                'publicKey'  => $publicKey,
                'privateKey' => $privateKey,
            ],
        ]);
    }

    public static function isConfigured(): bool
    {
        return trim((string) Config::get('vapid_public_key', '')) !== ''
            && trim((string) Config::get('vapid_private_key', '')) !== ''
            && trim((string) Config::get('vapid_subject', '')) !== '';
    }

    /** @param array{endpoint: string, p256dh: string, auth: string} $row
     *  @return array{success: bool, expired: bool, reason: string}
     */
    public function send(array $row, array $payload): array
    {
        $subscription = Subscription::create([
            'endpoint' => $row['endpoint'],
            'keys'     => [
                'p256dh' => $row['p256dh'],
                'auth'   => $row['auth'],
            ],
        ]);

        $report = $this->webPush->sendOneNotification(
            $subscription,
            json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );

        return [
            'success' => $report->isSuccess(),
            'expired' => $report->isSubscriptionExpired(),
            'reason'  => (string) $report->getReason(),
        ];
    }
}
