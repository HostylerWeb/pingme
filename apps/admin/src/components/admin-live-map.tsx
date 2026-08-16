'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { Feature, FeatureCollection, Point } from 'geojson';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getMapboxAccessToken, mapboxStyleUrl } from '@/lib/mapbox';
import { useAdminTheme } from './theme-provider';

const CLUSTERS_SOURCE = 'presence-clusters';
const CLUSTERS_FILL_LAYER = 'presence-clusters-fill';
const CLUSTERS_STROKE_LAYER = 'presence-clusters-stroke';
const CLUSTERS_LABEL_LAYER = 'presence-clusters-label';

type ClusterCell = {
  lat: number;
  lng: number;
  count: number;
  availableCount: number;
};

function buildClustersGeoJSON(cells: ClusterCell[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: cells.map(
      (cell): Feature<Point> => ({
        type: 'Feature',
        properties: {
          count: cell.count,
          availableCount: cell.availableCount,
        },
        geometry: { type: 'Point', coordinates: [cell.lng, cell.lat] },
      }),
    ),
  };
}

function fitMapToClusters(map: mapboxgl.Map, cells: ClusterCell[]) {
  const coords = cells.map((cell) => [cell.lng, cell.lat] as [number, number]);
  if (!coords.length) return;

  const bounds = coords.reduce(
    (current, coord) => current.extend(coord),
    new mapboxgl.LngLatBounds(coords[0], coords[0]),
  );

  map.fitBounds(bounds, { padding: 56, maxZoom: 13, duration: 600 });
}

function addClusterLayers(map: mapboxgl.Map, cells: ClusterCell[]) {
  if (!map.getSource(CLUSTERS_SOURCE)) {
    map.addSource(CLUSTERS_SOURCE, {
      type: 'geojson',
      data: buildClustersGeoJSON(cells),
    });
  }

  if (!map.getLayer(CLUSTERS_FILL_LAYER)) {
    map.addLayer({
      id: CLUSTERS_FILL_LAYER,
      type: 'circle',
      source: CLUSTERS_SOURCE,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'count'],
          1,
          28,
          3,
          40,
          8,
          56,
          15,
          72,
        ],
        'circle-color': '#c94e35',
        'circle-opacity': 0.18,
      },
    });
  }

  if (!map.getLayer(CLUSTERS_STROKE_LAYER)) {
    map.addLayer({
      id: CLUSTERS_STROKE_LAYER,
      type: 'circle',
      source: CLUSTERS_SOURCE,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'count'],
          1,
          28,
          3,
          40,
          8,
          56,
          15,
          72,
        ],
        'circle-color': 'transparent',
        'circle-stroke-color': '#c94e35',
        'circle-stroke-width': 2,
        'circle-stroke-opacity': 0.75,
      },
    });
  }

  if (!map.getLayer(CLUSTERS_LABEL_LAYER)) {
    map.addLayer({
      id: CLUSTERS_LABEL_LAYER,
      type: 'symbol',
      source: CLUSTERS_SOURCE,
      layout: {
        'text-field': ['to-string', ['get', 'count']],
        'text-size': 14,
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#c94e35',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    });
  }

  const source = map.getSource(CLUSTERS_SOURCE) as mapboxgl.GeoJSONSource;
  source.setData(buildClustersGeoJSON(cells));
  fitMapToClusters(map, cells);
}

function setupMapInteractions(
  map: mapboxgl.Map,
  popupRef: MutableRefObject<mapboxgl.Popup | null>,
  clusterRadiusMeters: number,
) {
  const interactiveLayers = [CLUSTERS_FILL_LAYER, CLUSTERS_LABEL_LAYER];

  map.on('click', interactiveLayers, (event) => {
    const feature = event.features?.[0] as Feature<Point> | undefined;
    if (!feature?.geometry || feature.geometry.type !== 'Point') return;

    const coordinates = [...feature.geometry.coordinates] as [number, number];
    const count = Number(feature.properties?.count ?? 0);
    const availableCount = Number(feature.properties?.availableCount ?? 0);

    popupRef.current?.remove();
    popupRef.current = new mapboxgl.Popup({ closeButton: false, offset: 12 })
      .setLngLat(coordinates)
      .setHTML(
        `<div style="font-size:13px;font-weight:600;margin-bottom:4px">${count} user${count === 1 ? '' : 's'} nearby</div>` +
          `<div style="font-size:11px;color:#8c8c8c;margin-bottom:2px">${availableCount} available on Wall</div>` +
          `<div style="font-size:11px;color:#8c8c8c">~${clusterRadiusMeters}m area (fuzzy)</div>`,
      )
      .addTo(map);
  });

  map.on('mouseenter', interactiveLayers, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', interactiveLayers, () => {
    map.getCanvas().style.cursor = '';
  });
}

export function AdminLiveMap({
  cells,
  clusterRadiusMeters,
}: {
  cells: ClusterCell[];
  clusterRadiusMeters: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const { theme } = useAdminTheme();
  const token = useMemo(() => getMapboxAccessToken(), []);

  useEffect(() => {
    if (!token || !containerRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: mapboxStyleUrl(theme === 'dark'),
      center: [0, 20],
      zoom: 2,
      attributionControl: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      addClusterLayers(map, cells);
      setupMapInteractions(map, popupRef, clusterRadiusMeters);
    });

    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [token, theme, clusterRadiusMeters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.isStyleLoaded()) {
      addClusterLayers(map, cells);
      return;
    }

    const onLoad = () => addClusterLayers(map, cells);
    map.once('load', onLoad);
    return () => {
      map.off('load', onLoad);
    };
  }, [cells]);

  if (!token) {
    return (
      <div className="flex aspect-[16/10] w-full items-center justify-center bg-surface-muted px-6 text-center text-sm text-ink-secondary">
        Set <code className="mx-1 rounded bg-background px-1.5 py-0.5 text-xs">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code>{' '}
        in <code className="mx-1 rounded bg-background px-1.5 py-0.5 text-xs">apps/admin/.env.local</code> (same{' '}
        <code className="mx-1 rounded bg-background px-1.5 py-0.5 text-xs">pk.*</code> token as mobile).
      </div>
    );
  }

  return <div ref={containerRef} className="aspect-[16/10] w-full" />;
}
