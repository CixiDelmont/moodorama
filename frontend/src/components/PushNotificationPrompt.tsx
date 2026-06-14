import { useState } from 'react';
import {
  disablePushNotifications,
  enablePushNotifications,
  isPushEnabledLocally,
  isPushSupported,
  pushPermissionState,
} from '../lib/push';

interface Props {
  userId: string;
  className?: string;
}

export default function PushNotificationPrompt({ userId, className }: Props) {
  const supported = isPushSupported();
  const [enabled, setEnabled] = useState(isPushEnabledLocally());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supported) return null;

  const permission = pushPermissionState();

  async function handleEnable() {
    setError(null);
    setBusy(true);
    try {
      await enablePushNotifications(userId);
      setEnabled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enable notifications.');
      setEnabled(isPushEnabledLocally());
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setError(null);
    setBusy(true);
    try {
      await disablePushNotifications(userId);
      setEnabled(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disable notifications.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={['push-prompt', className].filter(Boolean).join(' ')}>
      {enabled ? (
        <>
          <p className="push-prompt-status">Expiry reminders are on.</p>
          <button type="button" className="btn push-prompt-btn" disabled={busy} onClick={() => void handleDisable()}>
            Turn off notifications
          </button>
        </>
      ) : permission === 'denied' ? (
        <p className="push-prompt-status">
          Notifications are blocked in your browser settings.
        </p>
      ) : (
        <>
          <button type="button" className="btn push-prompt-btn" disabled={busy} onClick={() => void handleEnable()}>
            Notify me before my mood expires
          </button>
          <p className="push-prompt-hint">Works even when this tab is closed.</p>
        </>
      )}
      {error && <p className="push-prompt-error">{error}</p>}
    </div>
  );
}
