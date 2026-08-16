/** Mapbox public token (`pk.*` only). Same value as mobile `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`. */
export function getMapboxAccessToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
  return token || null;
}

export function mapboxStyleUrl(isDark: boolean): string {
  return isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12';
}
