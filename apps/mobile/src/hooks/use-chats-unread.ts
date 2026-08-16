import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';
import { useSocketAwareRefetchInterval } from './use-socket-aware-interval';

export function useChatsUnreadCount() {
  const userId = useAuthStore((s) => s.user?.id);
  const chatsRefetchInterval = useSocketAwareRefetchInterval({
    foreground: 15_000,
    mode: 'stop',
  });

  const { data } = useInfiniteQuery({
    queryKey: ['chats'],
    queryFn: ({ pageParam }) => api.getChats(pageParam, 20),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: Boolean(userId),
    refetchInterval: chatsRefetchInterval,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });

  return (data?.pages.flatMap((page) => page.data) ?? []).reduce(
    (sum, chat) => sum + (chat.unreadCount ?? 0),
    0,
  );
}
