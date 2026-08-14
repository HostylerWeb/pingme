import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';

export function useChatsUnreadCount() {
  const userId = useAuthStore((s) => s.user?.id);

  const { data } = useQuery({
    queryKey: ['chats'],
    queryFn: () => api.getChats(),
    enabled: Boolean(userId),
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  return (data?.data ?? []).reduce((sum, chat) => sum + (chat.unreadCount ?? 0), 0);
}
