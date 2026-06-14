<?php

/**
 * Sends Web Push reminders for moods expiring within the configured window.
 * Run hourly via cron / Task Scheduler:
 *
 *   0 * * * * php /path/to/backend/scripts/notify_expiring_moods.php
 */

declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';

use Moodorama\Config;
use Moodorama\Database;
use Moodorama\MoodRepository;
use Moodorama\PushSubscriptionRepository;
use Moodorama\WebPushSender;

if (!WebPushSender::isConfigured()) {
    fwrite(STDERR, "Web Push is not configured (missing VAPID keys in config.php).\n");
    exit(1);
}

$reminderHours = (int) Config::get('push_reminder_hours', 24);
$appUrl = rtrim((string) Config::get('push_app_url', 'https://tonicturtle.com/moodorama/'), '/') . '/';
$iconBase = (string) Config::get('push_icon_base_url', '');
if ($iconBase === '') {
    $fallbackIcon = (string) Config::get('push_icon_url', $appUrl . 'moods/joy.png');
    $iconBase = preg_replace('#/[^/]+$#', '', rtrim($fallbackIcon, '/')) . '/';
}
$iconExtension = (string) Config::get('push_icon_extension', 'png');

$pdo = Database::connection();
$moodRepo = new MoodRepository($pdo);
$subRepo = new PushSubscriptionRepository($pdo);
$sender = new WebPushSender();

$rows = $moodRepo->findExpiringForPush($reminderHours);
$sent = 0;
$failed = 0;
$removed = 0;
$notifiedUsers = [];

foreach ($rows as $row) {
    $userId = (string) $row['user_id'];
    $mood = (string) $row['mood'];
    $subscriptionId = (int) $row['subscription_id'];

    $payload = [
        'title' => 'Moodorama',
        'body'  => sprintf(
            'Your %s mood expires in about %d hour%s. Open Moodorama to update it.',
            ucfirst($mood),
            $reminderHours,
            $reminderHours === 1 ? '' : 's'
        ),
        'url'  => $appUrl,
        'mood' => $mood,
        'icon' => MoodRepository::pushIconUrl($mood, $iconBase, $iconExtension),
        'tag'  => 'mood-expiry-' . $userId,
    ];

    $result = $sender->send([
        'endpoint' => (string) $row['endpoint'],
        'p256dh'   => (string) $row['p256dh'],
        'auth'     => (string) $row['auth'],
    ], $payload);

    if ($result['expired']) {
        $subRepo->deleteById($subscriptionId);
        $removed++;
        fwrite(STDERR, "Removed expired subscription #{$subscriptionId} for {$userId}\n");
        continue;
    }

    if (!$result['success']) {
        $failed++;
        fwrite(STDERR, "Push failed for {$userId}: {$result['reason']}\n");
        continue;
    }

    $sent++;
    $notifiedUsers[$userId] = true;
}

foreach (array_keys($notifiedUsers) as $userId) {
    $moodRepo->markPushNotified($userId);
}

echo sprintf(
    "Push reminders: %d sent, %d failed, %d expired subscriptions removed (%d candidate rows).\n",
    $sent,
    $failed,
    $removed,
    count($rows)
);
