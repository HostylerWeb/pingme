import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';
import { useSocketAwareRefetchInterval } from './use-socket-aware-interval';

export function useNotificationSummary() {
  const userId = useAuthStore((s) => s.user?.id);
  const refetchInterval = useSocketAwareRefetchInterval({
    foreground: 30_000,
    mode: 'slow',
    connected: 60_000,
  });

  const { data } = useQuery({
    queryKey: ['notification-summary'],
    queryFn: () => api.getNotificationSummary(),
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
    refetchInterval,
    refetchIntervalInBackground: false,
  });

  return {
    wallUnread: data?.data.wallUnread ?? 0,
    icebreakerUnread: data?.data.icebreakerUnread ?? 0,
  };
}

function formatTabBadge(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count > 9 ? '9+' : String(count);
}

export function useWallTabBadge() {
  const { wallUnread } = useNotificationSummary();
  return formatTabBadge(wallUnread);
}

export function useIcebreakerTabBadge() {
  const { icebreakerUnread } = useNotificationSummary();
  return formatTabBadge(icebreakerUnread);
}
