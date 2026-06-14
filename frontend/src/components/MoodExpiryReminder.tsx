import { useEffect, useState } from 'react';
import {
  formatMoodTimeRemaining,
  msUntilMoodExpiry,
  shouldShowMoodExpiryReminder,
} from '../lib/mood-expiry';

/** Re-render while a mood is active so expiry visibility stays in sync. */
export function useMoodExpiryReminderVisible(expiresAt: string): boolean {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (msUntilMoodExpiry(expiresAt) <= 0) return;

    const remaining = msUntilMoodExpiry(expiresAt);
    const intervalMs = remaining < 3_600_000 ? 30_000 : 60_000;
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  return shouldShowMoodExpiryReminder(expiresAt);
}

interface Props {
  expiresAt: string;
  onRenew?: () => void;
  renewLabel?: string;
  className?: string;
}

export default function MoodExpiryReminder({
  expiresAt,
  onRenew,
  renewLabel = 'Update mood',
  className,
}: Props) {
  const visible = useMoodExpiryReminderVisible(expiresAt);

  if (!visible) return null;

  const remainingLabel = formatMoodTimeRemaining(msUntilMoodExpiry(expiresAt));

  return (
    <div
      className={['mood-expiry-reminder', className].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
    >
      <p>
        Your mood expires in <strong>{remainingLabel}</strong>
        {onRenew ? '.' : ' — pick a new one below to refresh it.'}
      </p>
      {onRenew && (
        <button type="button" className="btn mood-expiry-renew" onClick={onRenew}>
          {renewLabel}
        </button>
      )}
    </div>
  );
}
