/** Show the reminder when the mood expires within this window. */
export const MOOD_EXPIRY_REMINDER_MS = 24 * 60 * 60 * 1000;

/** Parse MySQL-style `expires_at` from the API (`YYYY-MM-DD HH:mm:ss`). */
export function parseMoodExpiresAt(expiresAt: string): Date {
  const normalized = expiresAt.includes('T') ? expiresAt : expiresAt.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

export function msUntilMoodExpiry(expiresAt: string, now = Date.now()): number {
  return parseMoodExpiresAt(expiresAt).getTime() - now;
}

export function shouldShowMoodExpiryReminder(expiresAt: string, now = Date.now()): boolean {
  const remaining = msUntilMoodExpiry(expiresAt, now);
  return remaining > 0 && remaining <= MOOD_EXPIRY_REMINDER_MS;
}

export function formatMoodTimeRemaining(ms: number): string {
  if (ms <= 0) return 'now';

  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) {
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }

  const hours = Math.ceil(ms / 3_600_000);
  if (hours < 24) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }

  const days = Math.ceil(ms / 86_400_000);
  return days === 1 ? '1 day' : `${days} days`;
}
