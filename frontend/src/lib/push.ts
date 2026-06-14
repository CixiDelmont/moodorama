import {
  fetchVapidPublicKey,
  subscribePush,
  unsubscribePush,
} from '../api';

const PUSH_PREF_KEY = 'moodorama.pushEnabled';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isPushEnabledLocally(): boolean {
  return localStorage.getItem(PUSH_PREF_KEY) === '1';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const swUrl = `${import.meta.env.BASE_URL}sw.js`;
  const existing = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  if (existing) return existing;
  return navigator.serviceWorker.register(swUrl);
}

export async function enablePushNotifications(userId: string): Promise<void> {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied.');
  }

  const { publicKey } = await fetchVapidPublicKey();
  if (!publicKey) {
    throw new Error('Push notifications are not configured on the server yet.');
  }

  const registration = await getServiceWorkerRegistration();
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Could not read push subscription from the browser.');
  }

  await subscribePush(userId, {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  });

  localStorage.setItem(PUSH_PREF_KEY, '1');
}

export async function disablePushNotifications(userId: string): Promise<void> {
  localStorage.removeItem(PUSH_PREF_KEY);

  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  try {
    await unsubscribePush(userId, subscription.endpoint);
  } catch {
    /* server cleanup is best-effort */
  }

  await subscription.unsubscribe();
}

/** Re-register subscription after reload when the user previously opted in. */
export async function syncPushSubscription(userId: string): Promise<void> {
  if (!isPushSupported() || !isPushEnabledLocally()) return;
  if (Notification.permission !== 'granted') return;

  try {
    await enablePushNotifications(userId);
  } catch {
    /* ignore transient network / config errors on background sync */
  }
}

export function pushPermissionState(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}
