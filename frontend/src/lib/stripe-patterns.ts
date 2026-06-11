import type { Mood } from '../types';
import { MOODS, MOOD_BY_ID } from '../moods';
import type { HexBin } from './h3';
import { hexStripeFacets, type StripeFacet } from './hex-polygon';

/** Moods below this share of the hex total are omitted from stripes. */
export const STRIPE_THRESHOLD = 0.3;

/** Moods that qualify for diagonal stripes in this hex (share > threshold). */
export function stripeMoods(counts: Record<Mood, number>, total: number): Mood[] {
  if (total <= 0) return [];

  return MOODS.map((m) => ({ id: m.id, count: counts[m.id] }))
    .filter((m) => m.count / total > STRIPE_THRESHOLD)
    .sort((a, b) => b.count - a.count)
    .map((m) => m.id);
}

export function binNeedsStripes(counts: Record<Mood, number>, total: number): boolean {
  return stripeMoods(counts, total).length >= 2;
}

/** Builds one polygon facet per diagonal stripe band across all mixed hexes. */
export function buildStripeFacets(bins: HexBin[], coverage = 0.95): StripeFacet[] {
  const facets: StripeFacet[] = [];

  for (const bin of bins) {
    const moods = stripeMoods(bin.counts, bin.total);
    if (moods.length < 2) continue;

    const colors = moods.map((m) => MOOD_BY_ID[m].rgb);
    const weights = moods.map((m) => bin.counts[m]);
    facets.push(...hexStripeFacets(bin, moods, colors, weights, coverage));
  }

  return facets;
}
