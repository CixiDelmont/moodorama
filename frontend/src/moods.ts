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

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function scaleToPeak(rgb: [number, number, number], targetPeak: number): [number, number, number] {
  const currentPeak = Math.max(...rgb);
  if (currentPeak <= 0 || targetPeak <= currentPeak) return rgb;

  const scale = targetPeak / currentPeak;
  return [
    Math.min(255, Math.round(rgb[0] * scale)),
    Math.min(255, Math.round(rgb[1] * scale)),
    Math.min(255, Math.round(rgb[2] * scale)),
  ];
}

/** Blends mood colours by their share of counts in a hexagon. */
export function mixedMoodRgb(counts: Record<Mood, number>): [number, number, number] {
  let total = 0;
  let activeMoods = 0;
  let soleMood: MoodMeta | null = null;

  for (const mood of MOODS) {
    const c = counts[mood.id];
    if (c <= 0) continue;
    total += c;
    activeMoods += 1;
    soleMood = mood;
  }

  if (total === 0) return MOOD_BY_ID.joy.rgb;
  if (activeMoods === 1 && soleMood) return soleMood.rgb;

  let sinH = 0;
  let cosH = 0;
  let sat = 0;
  let lit = 0;
  let peakSum = 0;

  for (const mood of MOODS) {
    const c = counts[mood.id];
    if (c <= 0) continue;
    const [h, s, l] = rgbToHsl(...mood.rgb);
    const angle = h * Math.PI * 2;
    sinH += Math.sin(angle) * c;
    cosH += Math.cos(angle) * c;
    sat += s * c;
    lit += l * c;
    peakSum += Math.max(...mood.rgb) * c;
  }

  let hue = Math.atan2(sinH, cosH) / (Math.PI * 2);
  if (hue < 0) hue += 1;

  const mixed = hslToRgb(hue, sat / total, lit / total);
  return scaleToPeak(mixed, peakSum / total);
}
