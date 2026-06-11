import type { Mood } from './types';

export interface MoodMeta {
  id: Mood;
  label: string;
  emoji: string;
  /** RGB used by deck.gl layers. */
  rgb: [number, number, number];
  /** CSS hex for UI chrome. */
  hex: string;
}

/** Inside Out's five core emotions, with their signature colours. */
export const MOODS: MoodMeta[] = [
  { id: 'joy',     label: 'Joy',     emoji: '😄', rgb: [255, 209, 59],  hex: '#ffd13b' },
  { id: 'sadness', label: 'Sadness', emoji: '😢', rgb: [76, 155, 232],  hex: '#4c9be8' },
  { id: 'fear',    label: 'Fear',    emoji: '😱', rgb: [160, 108, 213], hex: '#a06cd5' },
  { id: 'disgust', label: 'Disgust', emoji: '🤢', rgb: [122, 199, 79],  hex: '#7ac74f' },
  { id: 'anger',   label: 'Anger',   emoji: '😡', rgb: [232, 76, 76],   hex: '#e84c4c' },
];

export const MOOD_BY_ID: Record<Mood, MoodMeta> = MOODS.reduce(
  (acc, m) => {
    acc[m.id] = m;
    return acc;
  },
  {} as Record<Mood, MoodMeta>,
);
