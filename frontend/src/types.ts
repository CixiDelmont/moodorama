export type Mood = 'joy' | 'fear' | 'sadness' | 'disgust' | 'anger';

/** A single active mood point returned by GET /api/moods. */
export interface MoodPoint {
  mood: Mood;
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
