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
}

/**
 * Maps a map zoom level to an H3 resolution. Because deck.gl draws hexagons at
 * their true geographic size, increasing the resolution as the user zooms in
 * keeps the *on-screen* hexagon size roughly constant — each step just changes
 * how much land (and how many moods) a hexagon aggregates.
 *
 * Roughly one extra H3 resolution per ~1.5 zoom levels.
 */
export function resolutionForZoom(zoom: number): number {
  const table: Array<[number, number]> = [
    [1.5, 1],
    [3, 2],
    [4.5, 3],
    [6, 4],
    [7.5, 5],
    [9, 6],
    [10.5, 7],
    [12, 8],
    [13.5, 9],
  ];
  for (const [maxZoom, res] of table) {
    if (zoom < maxZoom) return res;
  }
  return 10;
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
  pointIds: number[];
}

export function binMoods(points: MoodPoint[], resolution: number): HexBin[] {
  const bins = new Map<string, BinAccumulator>();

  for (const p of points) {
    if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) continue;
    const hex = latLngToCell(p.latitude, p.longitude, resolution);
    let bin = bins.get(hex);
    if (!bin) {
      bin = { counts: EMPTY_COUNTS(), pointIds: [] };
      bins.set(hex, bin);
    }
    bin.counts[p.mood] += 1;
    bin.pointIds.push(p.id);
  }

  const result: HexBin[] = [];
  for (const [hex, { counts, pointIds }] of bins) {
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
    result.push({
      hex,
      dominantMood,
      total,
      counts,
      ...(total === 1 && pointIds.length === 1 ? { moodRowId: pointIds[0] } : {}),
    });
  }
  return result;
}

/** Returns the polygon boundary of an H3 cell as [lng, lat] pairs for deck.gl. */
export function hexBoundary(hex: string): [number, number][] {
  // h3-js returns [lat, lng]; deck.gl expects [lng, lat].
  return cellToBoundary(hex).map(([lat, lng]) => [lng, lat]);
}
