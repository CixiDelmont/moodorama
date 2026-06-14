import type { Mood, MoodPoint, MyMood } from './types';

function resolveApiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '');

  if (import.meta.env.PROD) {
    // Never call localhost from a production build (guards against stale .env on deploy).
    if (fromEnv && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(fromEnv)) {
      return fromEnv;
    }
    return 'https://tonicturtle.com/moodorama/api';
  }

  return fromEnv || 'http://localhost:8000/api';
}

const API_BASE: string = resolveApiBase();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(message);
  }
  // 204 / empty body
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function fetchActiveMoods(excludeSeed = false): Promise<MoodPoint[]> {
  const query = excludeSeed ? '?excludeSeed=1' : '';
  const data = await request<MoodPoint[] | MoodPoint | null>(`/moods${query}`);
  if (Array.isArray(data)) return data;
  if (data) return [data];
  return [];
}

export function fetchMyMood(userId: string): Promise<MyMood | null> {
  return request<MyMood | null>(`/moods/me?userId=${encodeURIComponent(userId)}`);
}

export function submitMood(params: {
  userId: string;
  mood: Mood;
  alias?: string;
  latitude: number;
  longitude: number;
}): Promise<MyMood> {
  return request<MyMood>('/moods', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
