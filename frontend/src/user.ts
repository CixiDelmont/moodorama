const STORAGE_KEY = 'moodorama.userId';

/**
 * Returns a stable anonymous identifier for this browser, creating and
 * persisting one (in localStorage) on first use. No login required.
 */
export function getUserId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers.
  return 'u-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
