import { MOODS, MOOD_BY_ID } from '../moods';
import type { Mood, SnapshotCountryCount } from '../types';

/** Weighted mood score from -100 (very negative) to +100 (very positive). */
export const MOOD_SCORE_WEIGHTS: Record<Mood, number> = {
  joy: 1,
  sadness: -0.6,
  fear: -0.5,
  disgust: -0.4,
  anger: -0.8,
};

const MOOD_WEIGHTS = MOOD_SCORE_WEIGHTS;

export interface CountryStats {
  countryCode: string;
  name: string;
  total: number;
  counts: Record<Mood, number>;
  score: number;
  joyPct: number;
  dominant: Mood;
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export function countryName(code: string): string {
  if (code === 'XX') return 'Unknown location';
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function aggregateCountryStats(rows: SnapshotCountryCount[]): CountryStats[] {
  const byCountry = new Map<string, Record<Mood, number>>();

  for (const row of rows) {
    let counts = byCountry.get(row.countryCode);
    if (!counts) {
      counts = { joy: 0, fear: 0, sadness: 0, disgust: 0, anger: 0 };
      byCountry.set(row.countryCode, counts);
    }
    counts[row.mood] += row.count;
  }

  const stats: CountryStats[] = [];

  for (const [countryCode, counts] of byCountry) {
    const total = MOODS.reduce((sum, m) => sum + counts[m.id], 0);
    if (total === 0) continue;

    let weighted = 0;
    let dominant: Mood = 'joy';
    let dominantCount = 0;

    for (const m of MOODS) {
      weighted += counts[m.id] * MOOD_WEIGHTS[m.id];
      if (counts[m.id] > dominantCount) {
        dominantCount = counts[m.id];
        dominant = m.id;
      }
    }

    stats.push({
      countryCode,
      name: countryName(countryCode),
      total,
      counts,
      score: Math.round((weighted / total) * 100),
      joyPct: Math.round((counts.joy / total) * 100),
      dominant,
    });
  }

  return stats;
}

export type CountrySortKey = 'name' | 'total' | 'score' | 'joyPct' | 'dominant';

export function sortCountries(
  rows: CountryStats[],
  key: CountrySortKey,
  dir: 'asc' | 'desc',
): CountryStats[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'total':
        cmp = a.total - b.total;
        break;
      case 'score':
        cmp = a.score - b.score;
        break;
      case 'joyPct':
        cmp = a.joyPct - b.joyPct;
        break;
      case 'dominant':
        cmp = MOOD_BY_ID[a.dominant].label.localeCompare(MOOD_BY_ID[b.dominant].label);
        break;
    }
    return cmp * factor;
  });
}

export function formatSnapshotTime(iso: string): string {
  const d = new Date(iso.replace(' ', 'T'));
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function scoreColor(score: number): string {
  if (score >= 40) return '#4ade80';
  if (score >= 10) return '#ffc857';
  if (score >= -10) return '#9aa3c4';
  if (score >= -40) return '#a970ff';
  return '#ff5d73';
}
