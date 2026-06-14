/// <reference lib="webworker" />

const DEFAULT_ICON = 'moods/joy.png';

function resolveUrl(path) {
  const base = self.registration.scope.replace(/\/?$/, '/');
  if (!path || path === '/') return base;
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.replace(/^\//, ''), base).href;
}

self.addEventListener('push', (event) => {
  /** @type {{ title?: string; body?: string; url?: string; icon?: string; tag?: string }} */
  let data = {
    title: 'Moodorama',
    body: 'Your mood is about to expire. Open Moodorama to update it.',
    url: '/',
    icon: DEFAULT_ICON,
    tag: 'mood-expiry',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const iconPath =
    data.icon ??
    (data.mood && /^[a-z]+$/.test(data.mood) ? `moods/${data.mood}.png` : DEFAULT_ICON);

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Moodorama', {
      body: data.body,
      icon: resolveUrl(iconPath),
      badge: resolveUrl(iconPath),
      tag: data.tag ?? 'mood-expiry',
      data: { url: resolveUrl(data.url ?? '/') },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || self.registration.scope;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
