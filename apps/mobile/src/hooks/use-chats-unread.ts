import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';
import { useSocketAwareRefetchInterval } from './use-socket-aware-interval';

export function useChatsUnreadCount() {
  const userId = useAuthStore((s) => s.user?.id);
  const chatsRefetchInterval = useSocketAwareRefetchInterval({
    foreground: 15_000,
    mode: 'stop',
  });

  const { data } = useQuery({
    queryKey: ['chats'],
    queryFn: () => api.getChats(),
    enabled: Boolean(userId),
    refetchInterval: chatsRefetchInterval,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });

  return (data?.data ?? []).reduce((sum, chat) => sum + (chat.unreadCount ?? 0), 0);
}
