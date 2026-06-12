import { cellToBoundary, cellToLatLng } from 'h3-js';

type LngLat = [number, number];
type XY = [number, number];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Diagonal stripe polygons are clipped in a flat plane then draped on the map.
 * That breaks for cells with a wide longitude span (antimeridian / polar H3
 * distortion) or high latitude — a handful of mixed hexes can paint artifacts
 * across the whole viewport. Those render as solid dominant-mood hexes instead.
 */
export function canRenderStripes(hex: string): boolean {
  const ring = cellToBoundary(hex, true) as LngLat[];
  if (ring.length < 3) return false;

  const lngs = ring.map(([lng]) => lng);
  const lats = ring.map(([, lat]) => lat);
  if (Math.max(...lngs) - Math.min(...lngs) > 100) return false;
  if (Math.max(...lats.map((lat) => Math.abs(lat))) > 70) return false;
  return true;
}

/** H3 cell ring as [lng, lat] with optional coverage shrink (matches H3HexagonLayer). */
export function hexPolygon(hex: string, coverage = 0.95): LngLat[] {
  const ring = cellToBoundary(hex, true) as LngLat[];
  if (coverage === 1) return ring;

  const [lat, lng] = cellToLatLng(hex);
  const closed = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0];

  const scaled = ring.map((pt, i) => {
    if (closed && i === ring.length - 1) return pt;
    return [lerp(lng, pt[0], coverage), lerp(lat, pt[1], coverage)] as LngLat;
  });

  if (closed) {
    scaled[scaled.length - 1] = scaled[0];
  }
  return scaled;
}

/** Web-mercator-ish plane coords for clipping (lng scaled by cos(lat)). */
function toPlane(ring: LngLat[]): XY[] {
  const lat0 = ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length;
  const cos = Math.cos((lat0 * Math.PI) / 180);
  return ring.map(([lng, lat]) => [lng * cos, lat] as XY);
}

function fromPlane(ring: XY[], cos: number): LngLat[] {
  return ring.map(([x, y]) => [x / cos, y] as LngLat);
}

/** Stripe axis: bands along x − y so stripes run bottom-left → top-right. */
function stripeCoord(p: XY): number {
  return p[0] - p[1];
}

function diagonal(ring: XY[]): number[] {
  return ring.map(stripeCoord);
}

function clipHalfPlane(ring: XY[], limit: number, keepHigh: boolean): XY[] {
  if (ring.length === 0) return [];

  const inside = (p: XY) => {
    const t = stripeCoord(p);
    return keepHigh ? t >= limit - 1e-9 : t <= limit + 1e-9;
  };

  const intersect = (a: XY, b: XY): XY => {
    const ta = stripeCoord(a);
    const tb = stripeCoord(b);
    const u = (limit - ta) / (tb - ta);
    return [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])];
  };

  const out: XY[] = [];
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i];
    const prev = ring[(i + ring.length - 1) % ring.length];
    const curIn = inside(cur);
    const prevIn = inside(prev);

    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur));
      out.push(cur);
    } else if (prevIn) {
      out.push(intersect(prev, cur));
    }
  }
  return out;
}

function clipBand(ring: XY[], low: number, high: number): XY[] {
  return clipHalfPlane(clipHalfPlane(ring, low, true), high, false);
}

export interface StripeFacet {
  hexBin: import('./h3').HexBin;
  polygon: LngLat[];
  rgb: [number, number, number];
}

/** Splits a hex into diagonal stripe polygons for moods above the threshold. */
export function hexStripeFacets(
  hexBin: import('./h3').HexBin,
  moods: import('../types').Mood[],
  colors: [number, number, number][],
  weights: number[],
  coverage = 0.95,
): StripeFacet[] {
  const ring = hexPolygon(hexBin.hex, coverage);
  const open =
    ring.length > 1 && ring[0][0] === ring[ring.length - 1][0]
      ? ring.slice(0, -1)
      : ring;

  if (open.length < 3) return [];

  const lat0 = open.reduce((sum, [, lat]) => sum + lat, 0) / open.length;
  const cos = Math.cos((lat0 * Math.PI) / 180);
  const plane = toPlane(open);
  const ts = diagonal(plane);
  let tMin = Math.min(...ts);
  let tMax = Math.max(...ts);

  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const facets: StripeFacet[] = [];
  let edge = tMin;

  for (let i = 0; i < moods.length; i++) {
    const tHigh = i === moods.length - 1 ? tMax : edge + ((tMax - tMin) * weights[i]) / totalWeight;
    const band = clipBand(plane, edge, tHigh);
    if (band.length >= 3) {
      const polygon = fromPlane(band, cos);
      polygon.push(polygon[0]);
      facets.push({ hexBin, polygon, rgb: colors[i] });
    }
    edge = tHigh;
  }

  return facets;
}
