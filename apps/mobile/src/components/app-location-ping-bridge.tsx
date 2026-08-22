import { useAuthStore } from '../stores/auth-store';
import { locationSetupStorage } from '../lib/location-setup-storage';
import { useAppLocationPing } from '../hooks/use-app-location-ping';
import { useAutoPresence } from '../hooks/use-auto-presence';

/** Keeps presence fresh and auto-online while logged in (until logout or force-stop). */
export function AppLocationPingBridge() {
  const user = useAuthStore((state) => state.user);
  const enabled = !!user && locationSetupStorage.isComplete();
  useAppLocationPing(enabled);
  useAutoPresence(enabled);
  return null;
}
