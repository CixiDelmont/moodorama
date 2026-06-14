import { latLngToCell, cellToBoundary } from 'h3-js';
import type { Mood, MoodPoint } from '../types';

export interface HexBin {
  hex: string;
  /** The single most-represented mood inside this hexagon. */
  dominantMood: Mood;
  /** Total moods aggregated into this hexagon. */
  total: number;
  /** Count per mood. */
  counts: Record<Mood, number>;
  /** DB row id when exactly one mood point falls in this hex. */
  moodRowId?: number;
  /** Display alias when exactly one mood point falls in this hex. */
  moodAlias?: string;
  /** Alias per mood when that mood's count in this hex is exactly 1. */
  aliasesByMood?: Partial<Record<Mood, string>>;
}

const H3_MIN_RES = 2;
const H3_MAX_RES = 11;
/** Extra map zoom before stepping up one H3 resolution (keeps on-screen hex size stable). */
const ZOOM_PER_H3_RES = 1.5;

/**
 * Maps a map zoom level to an H3 resolution. Because deck.gl draws hexagons at
 * their true geographic size, increasing the resolution as the user zooms in
 * keeps the *on-screen* hexagon size roughly constant — each step just changes
 * how much land (and how many moods) a hexagon aggregates.
 */
export function resolutionForZoom(zoom: number): number {
  const res = Math.round(H3_MIN_RES + zoom / ZOOM_PER_H3_RES -1);
  return Math.min(H3_MAX_RES, Math.max(H3_MIN_RES, res));
}

const EMPTY_COUNTS = (): Record<Mood, number> => ({
  joy: 0,
  fear: 0,
  sadness: 0,
  disgust: 0,
  anger: 0,
});

/**
 * Buckets mood points into H3 cells at the given resolution and determines the
 * dominant mood for each cell.
 */
interface BinAccumulator {
  counts: Record<Mood, number>;
  entries: Array<{ id: number; mood: Mood; alias?: string }>;
}

export function binMoods(points: MoodPoint[], resolution: number): HexBin[] {
  const bins = new Map<string, BinAccumulator>();

  for (const p of points) {
    if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) continue;
    const hex = latLngToCell(p.latitude, p.longitude, resolution);
    let bin = bins.get(hex);
    if (!bin) {
      bin = { counts: EMPTY_COUNTS(), entries: [] };
      bins.set(hex, bin);
    }
    bin.counts[p.mood] += 1;
    bin.entries.push({
      id: p.id,
      mood: p.mood,
      ...(p.alias ? { alias: p.alias } : {}),
    });
  }

  const result: HexBin[] = [];
  for (const [hex, { counts, entries }] of bins) {
    let dominantMood: Mood = 'joy';
    let best = -1;
    let total = 0;
    (Object.keys(counts) as Mood[]).forEach((mood) => {
      const c = counts[mood];
      total += c;
      if (c > best) {
        best = c;
        dominantMood = mood;
      }
    });
    const sole = total === 1 && entries.length === 1 ? entries[0] : null;
    const aliasesByMood: Partial<Record<Mood, string>> = {};
    for (const mood of Object.keys(counts) as Mood[]) {
      if (counts[mood] !== 1) continue;
      const entry = entries.find((e) => e.mood === mood);
      if (entry?.alias) aliasesByMood[mood] = entry.alias;
    }
    result.push({
      hex,
      dominantMood,
      total,
      counts,
      ...(Object.keys(aliasesByMood).length > 0 ? { aliasesByMood } : {}),
      ...(sole
        ? {
            moodRowId: sole.id,
            ...(sole.alias ? { moodAlias: sole.alias } : {}),
          }
        : {}),
    });
  }
  return result;
}

/** Returns the polygon boundary of an H3 cell as [lng, lat] pairs for deck.gl. */
export function hexBoundary(hex: string): [number, number][] {
  // h3-js returns [lat, lng]; deck.gl expects [lng, lat].
  return cellToBoundary(hex).map(([lat, lng]) => [lng, lat]);
}
