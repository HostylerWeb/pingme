import { useAuthStore } from '../stores/auth-store';
import { locationSetupStorage } from '../lib/location-setup-storage';
import { useAppLocationPing } from '../hooks/use-app-location-ping';

/** Keeps presence fresh on every tab while logged in. */
export function AppLocationPingBridge() {
  const user = useAuthStore((state) => state.user);
  const enabled = !!user && locationSetupStorage.isComplete();
  useAppLocationPing(enabled);
  return null;
}
