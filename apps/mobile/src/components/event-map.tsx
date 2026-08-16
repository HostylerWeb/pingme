import { Camera, MapView, PointAnnotation, StyleURL } from '@rnmapbox/maps';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { ensureMapboxConfigured } from '../lib/mapbox';
import { useTheme } from '../theme';

function useMapboxSetup() {
  useEffect(() => {
    ensureMapboxConfigured();
  }, []);
}

type EventMapProps = {
  latitude: number;
  longitude: number;
  style?: object;
};

function MapMarker() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.accent,
        borderWidth: 3,
        borderColor: colors.surface,
      }}
    />
  );
}

export function EventMapPreview({ latitude, longitude, style }: EventMapProps) {
  const { isDark } = useTheme();
  useMapboxSetup();

  return (
    <MapView
      style={[{ flex: 1 }, style]}
      styleURL={isDark ? StyleURL.Dark : StyleURL.Street}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      <Camera
        defaultSettings={{
          centerCoordinate: [longitude, latitude],
          zoomLevel: 15,
        }}
      />
      <PointAnnotation id="event-location" coordinate={[longitude, latitude]}>
        <MapMarker />
      </PointAnnotation>
    </MapView>
  );
}

export function EventMapPicker({
  latitude,
  longitude,
  recenterToken,
  onCoordinateChange,
  style,
}: EventMapProps & {
  recenterToken: number;
  onCoordinateChange: (coords: { latitude: number; longitude: number }) => void;
}) {
  const { isDark } = useTheme();
  useMapboxSetup();
  const cameraRef = useRef<React.ComponentRef<typeof Camera>>(null);
  const skipIdleRef = useRef(false);

  useEffect(() => {
    skipIdleRef.current = true;
    void cameraRef.current?.setCamera({
      centerCoordinate: [longitude, latitude],
      zoomLevel: 14,
      animationDuration: 300,
    });
    // Only fly the camera when search selects a place, not when the user pans the map.
  }, [recenterToken]);

  return (
    <View style={[{ flex: 1, overflow: 'hidden' }, style]}>
      <MapView
        style={{ flex: 1 }}
        styleURL={isDark ? StyleURL.Dark : StyleURL.Street}
        onMapIdle={(state) => {
          if (skipIdleRef.current) {
            skipIdleRef.current = false;
            return;
          }
          const [lng, lat] = state.properties.center;
          onCoordinateChange({ latitude: lat, longitude: lng });
        }}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [longitude, latitude],
            zoomLevel: 14,
          }}
        />
      </MapView>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ marginBottom: 24 }}>
          <MapMarker />
        </View>
      </View>
    </View>
  );
}
