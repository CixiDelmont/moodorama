import type { Mood } from './types';

export interface MoodMeta {
  id: Mood;
  label: string;
  /** @deprecated Use icon — kept for search/labels only */
  emoji: string;
  /** Path to a custom SVG/PNG in public/moods/ (replace files to rebrand). */
  icon: string;
  /** RGB used by deck.gl layers. */
  rgb: [number, number, number];
  /** CSS hex for UI chrome. */
  hex: string;
}

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

/** Inside Out's five core emotions, with their signature colours. */
export const MOODS: MoodMeta[] = [
  { id: 'joy',     label: 'Joy',     emoji: '😄', icon: asset('moods/joy.png'),     rgb: [255, 200, 87],  hex: '#ffc857' },
  { id: 'sadness', label: 'Sadness', emoji: '😢', icon: asset('moods/sadness.png'), rgb: [93, 169, 255],  hex: '#5da9ff' },
  { id: 'fear',    label: 'Fear',    emoji: '😱', icon: asset('moods/fear.png'),    rgb: [169, 112, 255], hex: '#a970ff' },
  { id: 'disgust', label: 'Disgust', emoji: '🤢', icon: asset('moods/disgust.png'), rgb: [74, 222, 128],  hex: '#4ade80' },
  { id: 'anger',   label: 'Anger',   emoji: '😡', icon: asset('moods/anger.png'),   rgb: [255, 93, 115],   hex: '#ff5d73' },
];

export const MOOD_BY_ID: Record<Mood, MoodMeta> = MOODS.reduce(
  (acc, m) => {
    acc[m.id] = m;
    return acc;
  },
  {} as Record<Mood, MoodMeta>,
);

/** Inline icon for deck.gl HTML tooltips. */
export function moodIconHtml(mood: Mood, size = 14): string {
  const { icon, label } = MOOD_BY_ID[mood];
  return `<img src="${icon}" alt="${label}" width="${size}" height="${size}" style="vertical-align:-2px;margin-right:3px" />`;
}
