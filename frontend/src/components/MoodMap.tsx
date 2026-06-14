import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import DeckGL from '@deck.gl/react';

import {

  MapView,

  _GlobeView as GlobeView,

  COORDINATE_SYSTEM,

  FlyToInterpolator,

  type Layer,

  type MapViewState,

  type ViewStateChangeParameters,

} from '@deck.gl/core';

import { H3HexagonLayer } from '@deck.gl/geo-layers';

import { GeoJsonLayer, PolygonLayer } from '@deck.gl/layers';

import { SimpleMeshLayer } from '@deck.gl/mesh-layers';

import { SphereGeometry } from '@luma.gl/engine';

import Map from 'react-map-gl/maplibre';

import 'maplibre-gl/dist/maplibre-gl.css';



import type { Mood, MoodPoint, MyMood } from '../types';

import { MOOD_BY_ID, moodIconHtml } from '../moods';
import MoodIcon from './MoodIcon';

import { fetchActiveMoods } from '../api';

import { binMoods, resolutionForZoom, type HexBin } from '../lib/h3';
import {
  boundsFromViewState,
  expandBounds,
  filterPointsInBounds,
  paddingForResolution,
} from '../lib/viewport';

import type { StripeFacet } from '../lib/hex-polygon';

import { partitionBins, solidFillColor } from '../lib/mood-hex-style';

import { buildStripeFacets } from '../lib/stripe-patterns';

import Legend from './Legend';
import MoodExpiryReminder, { useMoodExpiryReminderVisible } from './MoodExpiryReminder';
import PushNotificationPrompt from './PushNotificationPrompt';



const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const COUNTRIES =

  'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_scale_rank.geojson';

const REFRESH_MS = 60_000;

const EARTH_RADIUS_M = 6.3e6;
const FOCUS_ZOOM = 14;



type ViewMode = 'map' | 'globe';



function normalizeViewState(next: MapViewState, mode: ViewMode): MapViewState {

  const normalized: MapViewState = {

    longitude: next.longitude,

    latitude: next.latitude,

    zoom: next.zoom,

    pitch: mode === 'map' ? (next.pitch ?? 0) : 0,

    bearing: mode === 'map' ? (next.bearing ?? 0) : 0,

    minZoom: 0,

    maxZoom: 14,

  };

  if (next.transitionDuration != null) normalized.transitionDuration = next.transitionDuration;

  if (next.transitionInterpolator != null) {

    normalized.transitionInterpolator = next.transitionInterpolator;

  }

  return normalized;

}



interface Props {

  myMood: MyMood;

  onChangeMood: () => void;

  onOpenStats: () => void;

}



export default function MoodMap({ myMood, onChangeMood, onOpenStats }: Props) {

  const [viewMode, setViewMode] = useState<ViewMode>('map');

  const [points, setPoints] = useState<MoodPoint[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);



  const [viewState, setViewState] = useState<MapViewState>(() =>

    normalizeViewState(

      {

        longitude: myMood.longitude,

        latitude: myMood.latitude,

        zoom: 3.5,

        pitch: 0,

        bearing: 0,

      },

      'map',

    ),

  );



  const refreshTimer = useRef<number | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;

    const sync = () => {
      const { width, height } = el.getBoundingClientRect();
      setMapSize({ width: Math.round(width), height: Math.round(height) });
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);



  const load = useCallback(async (excludeSeed = false) => {

    try {

      const data = await fetchActiveMoods(excludeSeed);

      setPoints(data);

      setError(null);

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Could not load moods.');

    } finally {

      setLoading(false);

    }

  }, []);



  useEffect(() => {

    load();

    refreshTimer.current = window.setInterval(load, REFRESH_MS);

    return () => {

      if (refreshTimer.current) window.clearInterval(refreshTimer.current);

    };

  }, [load]);

  useEffect(() => {
    console.log('zoom:', viewState.zoom);
  }, [viewState.zoom]);

  const deferredViewState = useDeferredValue(viewState);
  const cullViewState = viewMode === 'map' ? deferredViewState : viewState;
  const resolution = resolutionForZoom(cullViewState.zoom);

  const visiblePoints = useMemo(() => {
    if (viewMode !== 'map' || mapSize.width < 1 || mapSize.height < 1) {
      return points;
    }
    const bounds = boundsFromViewState(cullViewState, mapSize.width, mapSize.height);
    const padded = expandBounds(bounds, paddingForResolution(resolution));
    return filterPointsInBounds(points, padded);
  }, [points, cullViewState, viewMode, mapSize.width, mapSize.height, resolution]);

  const bins = useMemo(
    () => binMoods(visiblePoints, resolution),
    [visiblePoints, resolution],
  );

  const { solidBins, stripeBins } = useMemo(() => partitionBins(bins), [bins]);

  const stripeFacets = useMemo(() => buildStripeFacets(stripeBins), [stripeBins]);



  const globeLayers = useMemo(

    () =>

      viewMode === 'globe'

        ? [

            new SimpleMeshLayer({

              id: 'globe-sphere',

              data: [0],

              mesh: new SphereGeometry({ radius: EARTH_RADIUS_M, nlat: 36, nlong: 72 }),

              coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,

              getPosition: () => [0, 0, 0],

              getColor: [16, 22, 44],

            }),

            new GeoJsonLayer({

              id: 'globe-countries',

              data: COUNTRIES,

              stroked: true,

              filled: true,

              getFillColor: [32, 42, 74],

              getLineColor: [70, 84, 122],

              lineWidthMinPixels: 0.5,

              parameters: { depthWriteEnabled: false, depthCompare: 'less-equal' },

              _subLayerProps: {

                'polygons-fill': { parameters: { depthWriteEnabled: false } },

                'polygons-stroke': { parameters: { depthWriteEnabled: false } },

              },

            }),

          ]

        : [],

    [viewMode],

  );



  const moodLayers = useMemo(() => {

    const globeParams =

      viewMode === 'globe'

        ? { parameters: { depthCompare: 'always' as const, depthWriteEnabled: false } }

        : {};



    const layers: Layer[] = [

      new H3HexagonLayer<HexBin>({

        id: `mood-hex-solid-${viewMode}`,

        data: solidBins,

        pickable: true,

        filled: true,

        stroked: true,

        extruded: false,

        coverage: 0.95,

        lineWidthMinPixels: 1,

        getHexagon: (d) => d.hex,

        getFillColor: (d) => solidFillColor(d),

        getLineColor: [255, 255, 255, 40],

        updateTriggers: { getFillColor: [resolution, visiblePoints.length] },

        ...globeParams,

      }),

    ];



    if (stripeFacets.length > 0) {

      layers.push(

        new PolygonLayer<StripeFacet>({

          id: `mood-hex-stripe-${viewMode}`,

          data: stripeFacets,

          pickable: true,

          filled: true,

          stroked: true,

          lineWidthMinPixels: 1,

          getPolygon: (d) => d.polygon,

          getFillColor: (d) => [...d.rgb, 255],

          getLineColor: [255, 255, 255, 40],

          updateTriggers: { getFillColor: [resolution, visiblePoints.length] },

          ...globeParams,

        }),

      );

    }



    return layers;

  }, [solidBins, stripeFacets, viewMode, resolution, visiblePoints.length]);



  const layers = useMemo(() => [...globeLayers, ...moodLayers], [globeLayers, moodLayers]);



  const views = useMemo(

    () =>

      viewMode === 'globe'

        ? new GlobeView({ id: 'view' })

        : new MapView({ id: 'view', repeat: true }),

    [viewMode],

  );



  const handleViewStateChange = useCallback(

    ({ viewState: next }: ViewStateChangeParameters<MapViewState>) => {

      setViewState(normalizeViewState(next, viewMode));

    },

    [viewMode],

  );



  const switchViewMode = useCallback((mode: ViewMode) => {

    setViewState((prev) => normalizeViewState(prev, mode));

    setViewMode(mode);

  }, []);

  const flyToMyMood = useCallback(() => {
    if (viewMode === 'globe') {
      setViewMode('map');
    }

    setViewState((prev) =>
      normalizeViewState(
        {
          ...prev,
          longitude: myMood.longitude,
          latitude: myMood.latitude,
          zoom: FOCUS_ZOOM,
          transitionDuration: 1200,
          transitionInterpolator: new FlyToInterpolator(),
        },
        'map',
      ),
    );
  }, [myMood.latitude, myMood.longitude, viewMode]);

  const mine = MOOD_BY_ID[myMood.mood];
  const showExpiryReminder = useMoodExpiryReminderVisible(myMood.expiresAt);



  return (

    <div className="map-root" ref={mapRef}>

      {loading && <div className="loading-pill">Loading moods…</div>}



      <DeckGL

        key={viewMode}

        views={views}

        viewState={viewState}

        controller

        onViewStateChange={handleViewStateChange}

        layers={layers}

        getTooltip={getTooltip}

      >

        {viewMode === 'map' && <Map reuseMaps mapStyle={BASEMAP_STYLE} />}

      </DeckGL>



      <div className="overlay top-left">

        <div className="brand">

          Moodorama

          <small>

            The world&apos;s feelings, live. {/* Mixed hexes use diagonal stripes (30%+ each). */}

          </small>

        </div>

        <div className="your-mood">

          Your mood:

          <button
            type="button"
            className="chip chip-focus"
            style={{ background: mine.hex }}
            title="Zoom to your mood on the map"
            onClick={flyToMyMood}
          >
            {/* {myMood.alias ? `${myMood.alias} · ` : ''} */}

            <MoodIcon mood={myMood.mood} size={16} className="chip-icon" />

            {mine.label}

          </button>

        </div>

        {!showExpiryReminder && (
          <button className="btn primary" style={{ marginTop: 12 }} onClick={onChangeMood}>
            Change my mood
          </button>
        )}

        <MoodExpiryReminder
          expiresAt={myMood.expiresAt}
          onRenew={onChangeMood}
          renewLabel="Change my mood"
        />

        <PushNotificationPrompt userId={myMood.userId} />

        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

      </div>



      <div className="overlay top-right">

        <div className="map-toolbar">

          <div className="map-toolbar-controls">

            <div className="toggle">

              <button
                type="button"
                className={viewMode === 'map' ? 'active' : ''}
                onClick={() => switchViewMode('map')}
                aria-label="Map view"
                title="Map"
              >
                <MapViewIcon />
                <span className="btn-label">Map</span>
              </button>

              <button
                type="button"
                className={viewMode === 'globe' ? 'active' : ''}
                onClick={() => switchViewMode('globe')}
                aria-label="Globe view"
                title="Globe"
              >
                <GlobeViewIcon />
                <span className="btn-label">Globe</span>
              </button>

            </div>

            <div className="map-toolbar-actions">
              <button
                type="button"
                className="btn"
                onClick={(e) => void load(e.ctrlKey)}
                aria-label="Refresh moods"
                title="Refresh"
              >
                <RefreshIcon />
                <span className="btn-label">Refresh</span>
              </button>

              <button
                type="button"
                className="btn map-toolbar-stats-btn"
                onClick={onOpenStats}
                aria-label="View mood stats"
                title="Stats"
              >
                <StatsIcon />
              </button>
            </div>

          </div>

          {!loading && (
            <div className="map-toolbar-footer">
              <button
                type="button"
                className="map-toolbar-link"
                onClick={onOpenStats}
              >
                Stats
              </button>
              <p className="mood-count">
                {points.length.toLocaleString()} active mood{points.length === 1 ? '' : 's'}
              </p>
            </div>
          )}

        </div>

      </div>



      <Legend />

    </div>

  );

}



function MapViewIcon() {
  return (
    <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function GlobeViewIcon() {
  return (
    <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="1 4 1 10 7 10" />
      <polyline points="23 20 23 14 17 14" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  );
}

function StatsIcon() {
  return (
    <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function moodIdentityPart(alias?: string, rowId?: number): string {
  if (alias) return ` (${escapeHtml(alias)})`;
//   if (rowId !== undefined) return ` (#${rowId})`;
  return '';
}

function moodLineHtml(mood: Mood, alias?: string, strong = false, rowId?: number): string {
  const label = MOOD_BY_ID[mood].label;
  const text = `${moodIconHtml(mood)} ${label}${moodIdentityPart(alias, rowId)}`;
  return strong ? `<strong>${text}</strong>` : text;
}

function getTooltip({ object }: { object?: HexBin | StripeFacet | null }) {

  const bin = object && 'hexBin' in object ? object.hexBin : object;

  if (!bin) return null;



  const meta = MOOD_BY_ID[bin.dominantMood];
  const soleAlias = bin.total === 1 ? bin.aliasesByMood?.[bin.dominantMood] ?? bin.moodAlias : undefined;
  const soleLabel =
    bin.total === 1
      ? moodLineHtml(bin.dominantMood, soleAlias, true, bin.moodRowId)
      : `<strong>${moodIconHtml(bin.dominantMood)} ${meta.label}</strong> leads here`;

  const breakdown = (Object.keys(bin.counts) as (keyof typeof bin.counts)[])

    .filter((m) => bin.counts[m] > 0)

    .sort((a, b) => bin.counts[b] - bin.counts[a])

    .map((m) => {
      const count = bin.counts[m];
      const alias = count === 1 ? bin.aliasesByMood?.[m] : undefined;
      const rowId = count === 1 ? bin.idsByMood?.[m] : undefined;
      return `${moodIconHtml(m)} ${MOOD_BY_ID[m].label}: ${count}${moodIdentityPart(alias, rowId)}`;
    })

    .join('<br/>');



  return {

    html: `<div class="tooltip">${soleLabel}<br/>${bin.total} mood(s) in this area<br/><br/>${breakdown}</div>`,

    style: {

      background: '#12182e',

      color: '#eef1fb',

      border: '1px solid rgba(255,255,255,0.12)',

      borderRadius: '8px',

      padding: '8px 10px',

      fontSize: '12px',

    },

  };

}


