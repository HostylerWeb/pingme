import Mapbox from '@rnmapbox/maps';

const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

if (accessToken) {
  Mapbox.setAccessToken(accessToken);
}

Mapbox.setTelemetryEnabled(false);

export { Mapbox };
