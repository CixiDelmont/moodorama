import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [showManageModal, setShowManageModal] = useState(false);

  useEffect(() => {
    if (!showManageModal) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) setShowManageModal(false);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showManageModal, busy]);

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
      setShowManageModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disable notifications.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={['push-prompt', className].filter(Boolean).join(' ')}>
      {enabled ? (
        <p className="push-prompt-status push-prompt-status-action">
          <button
            type="button"
            className="push-prompt-status-btn"
            disabled={busy}
            onClick={() => {
              setError(null);
              setShowManageModal(true);
            }}
          >
            Expiry reminders are on.
          </button>
        </p>
      ) : permission === 'denied' ? (
        <p className="push-prompt-status">
          Notifications are blocked in your browser settings.
        </p>
      ) : (
        <>
          <button type="button" className="btn push-prompt-btn" disabled={busy} onClick={() => void handleEnable()}>
            Notify me before expiry
          </button>
          {/* <p className="push-prompt-hint">Works even when this tab is closed.</p> */}
        </>
      )}
      {error && <p className="push-prompt-error">{error}</p>}

      {showManageModal &&
        createPortal(
          <div
            className="push-modal-backdrop"
            role="presentation"
            onClick={() => {
              if (!busy) setShowManageModal(false);
            }}
          >
            <div
              className="push-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="push-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="push-modal-title" className="push-modal-title">
                Expiry reminders
              </h2>
              <p className="push-modal-text">
                You&apos;ll get a notification before your mood expires, even when this tab is closed.
              </p>
              <div className="push-modal-actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy}
                  onClick={() => setShowManageModal(false)}
                >
                  Keep notifications
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => void handleDisable()}>
                  Turn off notifications
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
