<?php

/**
 * Moodorama API entrypoint / router.
 *
 * Routes:
 *   GET  /api/health        -> { ok: true }
 *   GET  /api/moods         -> [ { id, mood, alias?, latitude, longitude, updatedAt, expiresAt }, ... ]  (active only; ?excludeSeed=1 omits seed-* rows)
 *   GET  /api/moods/me      -> current user's mood (requires ?userId=)
 *   POST /api/moods         -> upsert { userId, mood, alias?, latitude, longitude }
 *   GET  /api/push/vapid-public-key -> { publicKey } | { publicKey: null }
 *   POST /api/push/subscribe        -> { userId, subscription }
 *   POST /api/push/unsubscribe      -> { userId, endpoint }
 */

declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';

use Moodorama\Config;
use Moodorama\Database;
use Moodorama\Http;
use Moodorama\MoodRepository;
use Moodorama\PushSubscriptionRepository;
use Moodorama\WebPushSender;

Http::applyCors();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function requireUserId(string $userId): void
{
    if ($userId === '' || !preg_match('/^[a-zA-Z0-9_-]{8,64}$/', $userId)) {
        Http::error('A valid userId is required', 400);
    }
}

// Normalise the path: strip query string and any base directory prefix.
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$path = '/' . trim($uri, '/');
// Allow the API to live behind a /api prefix regardless of how it's mounted.
$path = preg_replace('#^.*?(/api/.*)$#', '$1', $path) ?? $path;

try {
    switch (true) {
        case $path === '/api/health' && $method === 'GET':
            Http::json(['ok' => true]);
            // no break (json exits)

        case $path === '/api/moods' && $method === 'GET':
            $repo = new MoodRepository(Database::connection());
            $excludeSeed = ($_GET['excludeSeed'] ?? '') === '1';
            Http::json($repo->activeMoods($excludeSeed));
            // no break

        case $path === '/api/moods/me' && $method === 'GET':
            $userId = trim((string) ($_GET['userId'] ?? ''));
            if ($userId === '') {
                Http::error('userId is required', 400);
            }
            $repo = new MoodRepository(Database::connection());
            $mood = $repo->findByUser($userId);
            Http::json($mood ?? null);
            // no break

        case $path === '/api/moods' && $method === 'POST':
            $body = Http::jsonBody();
            $userId = trim((string) ($body['userId'] ?? ''));
            $mood = strtolower(trim((string) ($body['mood'] ?? '')));
            $lat = $body['latitude'] ?? null;
            $lng = $body['longitude'] ?? null;

            if ($userId === '' || !preg_match('/^[a-zA-Z0-9_-]{8,64}$/', $userId)) {
                Http::error('A valid userId is required', 400);
            }
            if (!in_array($mood, MoodRepository::MOODS, true)) {
                Http::error('mood must be one of: ' . implode(', ', MoodRepository::MOODS), 422);
            }
            if (!is_numeric($lat) || !is_numeric($lng)) {
                Http::error('latitude and longitude are required numbers', 422);
            }
            $lat = (float) $lat;
            $lng = (float) $lng;
            if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
                Http::error('latitude/longitude out of range', 422);
            }

            try {
                $alias = MoodRepository::normalizeAlias($body['alias'] ?? null);
            } catch (\InvalidArgumentException $e) {
                Http::error($e->getMessage(), 422);
            }

            $repo = new MoodRepository(Database::connection());
            $saved = $repo->upsert($userId, $mood, $lat, $lng, $alias);
            Http::json($saved, 201);
            // no break

        case $path === '/api/push/vapid-public-key' && $method === 'GET':
            $publicKey = WebPushSender::isConfigured()
                ? trim((string) Config::get('vapid_public_key', ''))
                : null;
            Http::json(['publicKey' => $publicKey ?: null]);
            // no break

        case $path === '/api/push/subscribe' && $method === 'POST':
            $body = Http::jsonBody();
            $userId = trim((string) ($body['userId'] ?? ''));
            requireUserId($userId);
            $subscription = $body['subscription'] ?? null;
            if (!is_array($subscription)) {
                Http::error('subscription is required', 422);
            }
            try {
                $repo = new PushSubscriptionRepository(Database::connection());
                $repo->upsert($userId, $subscription);
            } catch (\InvalidArgumentException $e) {
                Http::error($e->getMessage(), 422);
            }
            Http::json(['ok' => true], 201);
            // no break

        case $path === '/api/push/unsubscribe' && $method === 'POST':
            $body = Http::jsonBody();
            $userId = trim((string) ($body['userId'] ?? ''));
            $endpoint = trim((string) ($body['endpoint'] ?? ''));
            requireUserId($userId);
            if ($endpoint === '') {
                Http::error('endpoint is required', 422);
            }
            $repo = new PushSubscriptionRepository(Database::connection());
            $repo->deleteByEndpoint($userId, $endpoint);
            Http::json(['ok' => true]);
            // no break

        default:
            Http::error('Not found: ' . $method . ' ' . $path, 404);
    }
} catch (\Throwable $e) {
    Http::error('Server error: ' . $e->getMessage(), 500);
}
