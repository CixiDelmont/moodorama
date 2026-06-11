import { WebMercatorViewport } from '@deck.gl/core';
import { getHexagonEdgeLengthAvg } from 'h3-js';
import type { MoodPoint } from '../types';

export interface GeoBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface MapViewLike {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
}

/** Geographic bounds of the map canvas for the current view. */
export function boundsFromViewState(
  viewState: MapViewLike,
  width: number,
  height: number,
): GeoBounds {
  const viewport = new WebMercatorViewport({
    width,
    height,
    longitude: viewState.longitude,
    latitude: viewState.latitude,
    zoom: viewState.zoom,
    pitch: viewState.pitch ?? 0,
    bearing: viewState.bearing ?? 0,
  });
  const [west, south, east, north] = viewport.getBounds();
  return { west, south, east, north };
}

export function expandBounds(bounds: GeoBounds, paddingDeg: number): GeoBounds {
  return {
    west: bounds.west - paddingDeg,
    south: bounds.south - paddingDeg,
    east: bounds.east + paddingDeg,
    north: bounds.north + paddingDeg,
  };
}

/** Pad viewport so edge hexagons are not clipped. */
export function paddingForResolution(resolution: number): number {
  const km = getHexagonEdgeLengthAvg(resolution, 'km');
  return (km * 2.2) / 111;
}

export function pointInBounds(latitude: number, longitude: number, bounds: GeoBounds): boolean {
  if (latitude < bounds.south || latitude > bounds.north) return false;
  if (bounds.west <= bounds.east) {
    return longitude >= bounds.west && longitude <= bounds.east;
  }
  return longitude >= bounds.west || longitude <= bounds.east;
}

export function filterPointsInBounds(points: MoodPoint[], bounds: GeoBounds): MoodPoint[] {
  return points.filter((p) => pointInBounds(p.latitude, p.longitude, bounds));
}
