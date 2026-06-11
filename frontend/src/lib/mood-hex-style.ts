import { MOOD_BY_ID } from '../moods';
import type { HexBin } from './h3';
import { binNeedsStripes } from './stripe-patterns';

export function partitionBins(bins: HexBin[]): { solidBins: HexBin[]; stripeBins: HexBin[] } {
  const solidBins: HexBin[] = [];
  const stripeBins: HexBin[] = [];

  for (const bin of bins) {
    if (binNeedsStripes(bin.counts, bin.total)) {
      stripeBins.push(bin);
    } else {
      solidBins.push(bin);
    }
  }

  return { solidBins, stripeBins };
}

export function solidFillColor(bin: HexBin): [number, number, number, number] {
  const [r, g, b] = MOOD_BY_ID[bin.dominantMood].rgb;
  return [r, g, b, 255];
}
