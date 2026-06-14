export type Mood = 'joy' | 'fear' | 'sadness' | 'disgust' | 'anger';

/** A single active mood point returned by GET /api/moods. */
export interface MoodPoint {
  id: number;
  mood: Mood;
  /** Optional display name shown on the map when alone in a hex. */
  alias?: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
  expiresAt: string;
}

/** The current user's record returned by GET /api/moods/me. */
export interface MyMood extends MoodPoint {
  userId: string;
  active: boolean;
}

/** Hourly snapshot metadata from GET /api/snapshots. */
export interface SnapshotMeta {
  snapshotAt: string;
  pointCount: number;
  capturedAt: string;
}

/** Per-country mood count from GET /api/snapshots/countries. */
export interface SnapshotCountryCount {
  countryCode: string;
  mood: Mood;
  count: number;
}
