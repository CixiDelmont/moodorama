import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import DeckGL from '@deck.gl/react';

import {

  MapView,

  _GlobeView as GlobeView,

  COORDINATE_SYSTEM,

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



import type { MoodPoint, MyMood } from '../types';

import { MOOD_BY_ID } from '../moods';

import { fetchActiveMoods } from '../api';

import { binMoods, resolutionForZoom, type HexBin } from '../lib/h3';

import type { StripeFacet } from '../lib/hex-polygon';

import { partitionBins, solidFillColor } from '../lib/mood-hex-style';

import { buildStripeFacets } from '../lib/stripe-patterns';

import Legend from './Legend';



const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const COUNTRIES =

  'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_scale_rank.geojson';

const REFRESH_MS = 60_000;

const EARTH_RADIUS_M = 6.3e6;



type ViewMode = 'map' | 'globe';



function normalizeViewState(next: MapViewState, mode: ViewMode): MapViewState {

  return {

    longitude: next.longitude,

    latitude: next.latitude,

    zoom: next.zoom,

    pitch: mode === 'map' ? (next.pitch ?? 0) : 0,

    bearing: mode === 'map' ? (next.bearing ?? 0) : 0,

    minZoom: 0,

    maxZoom: 14,

  };

}



interface Props {

  myMood: MyMood;

  onChangeMood: () => void;

}



export default function MoodMap({ myMood, onChangeMood }: Props) {

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



  const load = useCallback(async () => {

    try {

      const data = await fetchActiveMoods();

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



  const resolution = resolutionForZoom(viewState.zoom);

  const bins = useMemo(() => binMoods(points, resolution), [points, resolution]);

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

        updateTriggers: { getFillColor: [resolution, points.length] },

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

          updateTriggers: { getFillColor: [resolution, points.length] },

          ...globeParams,

        }),

      );

    }



    return layers;

  }, [solidBins, stripeFacets, viewMode, resolution, points.length]);



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



  const mine = MOOD_BY_ID[myMood.mood];



  return (

    <div className="map-root">

      {loading && <div className="loading-pill">Loading moods…</div>}



      <DeckGL

        key={viewMode}

        views={views}

        initialViewState={viewState}

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

            The world&apos;s feelings, live. Mixed hexes use diagonal stripes (30%+ each).

          </small>

        </div>

        <div className="your-mood">

          Your mood:

          <span className="chip" style={{ background: mine.hex }}>

            {myMood.alias ? `${myMood.alias} · ` : ''}

            {mine.emoji} {mine.label}

          </span>

        </div>

        <button className="btn primary" style={{ marginTop: 12 }} onClick={onChangeMood}>

          Change my mood

        </button>

        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

      </div>



      <div className="overlay top-right">

        <div className="toggle">

          <button

            className={viewMode === 'map' ? 'active' : ''}

            onClick={() => switchViewMode('map')}

          >

            Map

          </button>

          <button

            className={viewMode === 'globe' ? 'active' : ''}

            onClick={() => switchViewMode('globe')}

          >

            Globe

          </button>

        </div>

        <button className="btn" onClick={load}>

          Refresh

        </button>

      </div>



      <Legend />

    </div>

  );

}



function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTooltip({ object }: { object?: HexBin | StripeFacet | null }) {

  const bin = object && 'hexBin' in object ? object.hexBin : object;

  if (!bin) return null;



  const meta = MOOD_BY_ID[bin.dominantMood];
  const soleLabel =
    bin.total === 1 && bin.moodAlias
      ? `<strong>${escapeHtml(bin.moodAlias)}</strong> · ${meta.emoji} ${meta.label}`
      : `<strong>${meta.emoji} ${meta.label}</strong> leads here`;

  const breakdown = (Object.keys(bin.counts) as (keyof typeof bin.counts)[])

    .filter((m) => bin.counts[m] > 0)

    .sort((a, b) => bin.counts[b] - bin.counts[a])

    .map((m) => {

      const row =

        bin.total === 1 && bin.moodRowId != null && !bin.moodAlias

          ? ` <span style="opacity:0.7">#${bin.moodRowId}</span>`

          : '';

      return `${MOOD_BY_ID[m].emoji} ${MOOD_BY_ID[m].label}: ${bin.counts[m]}${row}`;

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


