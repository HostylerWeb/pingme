import Mapbox from '@rnmapbox/maps';

let configured = false;

export function ensureMapboxConfigured() {
  if (configured) return;

  const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (accessToken) {
    Mapbox.setAccessToken(accessToken);
  }
  Mapbox.setTelemetryEnabled(false);
  configured = true;
}
