import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';
import { useSocketAwareRefetchInterval } from './use-socket-aware-interval';

export function useWallNotifications(enabled = true) {
  const userId = useAuthStore((s) => s.user?.id);
  const refetchInterval = useSocketAwareRefetchInterval({
    foreground: 30_000,
    mode: 'slow',
    connected: 60_000,
  });

  return useQuery({
    queryKey: ['wall-notifications'],
    queryFn: () => api.getWallNotifications(),
    enabled: Boolean(userId) && enabled,
    placeholderData: keepPreviousData,
    staleTime: 20_000,
    refetchInterval: enabled ? refetchInterval : false,
    refetchIntervalInBackground: false,
  });
}
