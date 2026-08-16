/** ~550 m grid cells — groups nearby users without exposing exact pins. */
export const CLUSTER_CELL_SIZE_DEGREES = 0.005;
export const CLUSTER_RADIUS_METERS = 550;

export const ADMIN_MAP_CACHE_KEY = 'admin:map:heatmap';
export const ADMIN_MAP_WATCHING_KEY = 'admin:map:watching';
/** Longer than refresh interval so reads never miss between worker ticks. */
export const ADMIN_MAP_CACHE_TTL_SECONDS = 90;
/** Slightly longer than the admin map poll interval (60s). */
export const ADMIN_MAP_WATCHING_TTL_SECONDS = 90;
export const ADMIN_MAP_REFRESH_INTERVAL_MS = 30_000;

export type AdminHeatmapCell = {
  lat: number;
  lng: number;
  count: number;
  wallCount: number;
  icebreakerCount: number;
};

export type AdminHeatmapResponse = {
  totalActive: number;
  wallCount: number;
  icebreakerCount: number;
  clusterRadiusMeters: number;
  cells: AdminHeatmapCell[];
  cachedAt: string;
  ready: boolean;
};

export function emptyAdminHeatmap(): AdminHeatmapResponse {
  return {
    totalActive: 0,
    wallCount: 0,
    icebreakerCount: 0,
    clusterRadiusMeters: CLUSTER_RADIUS_METERS,
    cells: [],
    cachedAt: new Date(0).toISOString(),
    ready: false,
  };
}
