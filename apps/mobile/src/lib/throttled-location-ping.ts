import { FOREGROUND_PING_INTERVAL_MS } from '@pingme/shared';
import { api } from './api';

export interface PingCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

let lastPingAt = 0;

/** Avoid duplicate pings when Wall, Icebreaker, and app-level hooks run together. */
export async function throttledLocationPing(
  coords: PingCoordinates,
  minIntervalMs = FOREGROUND_PING_INTERVAL_MS - 5_000,
) {
  const now = Date.now();
  if (now - lastPingAt < minIntervalMs) {
    return false;
  }

  await api.pingLocation(coords);
  lastPingAt = now;
  return true;
}
