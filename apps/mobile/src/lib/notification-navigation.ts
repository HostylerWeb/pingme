import type { Href } from 'expo-router';

export type NotificationNavigationPayload = {
  type: string;
  title?: string;
  body?: string;
  postId?: string;
  replyId?: string;
  matchId?: string;
  chatId?: string;
};

export function parseNotificationData(
  data: Record<string, unknown> | undefined,
): NotificationNavigationPayload | null {
  if (!data?.type || typeof data.type !== 'string') return null;

  return {
    type: data.type,
    title: typeof data.title === 'string' ? data.title : undefined,
    body: typeof data.body === 'string' ? data.body : undefined,
    postId: data.postId != null ? String(data.postId) : undefined,
    replyId: data.replyId != null ? String(data.replyId) : undefined,
    matchId: data.matchId != null ? String(data.matchId) : undefined,
    chatId: data.chatId != null ? String(data.chatId) : undefined,
  };
}

export function shouldSuppressIncomingBanner(
  pathname: string,
  payload: NotificationNavigationPayload,
): boolean {
  if (payload.chatId && pathname.includes(`/chat/${payload.chatId}`)) return true;
  if (payload.postId && pathname.includes(`/post/${payload.postId}`)) return true;
  if (payload.type === 'icebreaker.interest' && pathname.includes('icebreaker')) return true;
  if (
    (payload.type === 'icebreaker.match' || payload.type === 'match.request') &&
    payload.matchId &&
    pathname.includes(`/match/${payload.matchId}`)
  ) {
    return true;
  }
  return false;
}

export function getNotificationHref(payload: NotificationNavigationPayload): Href | null {
  if (payload.type === 'wall.reply' && payload.postId) {
    return `/post/${payload.postId}`;
  }
  if (payload.type === 'chat.message' && payload.chatId) {
    return `/chat/${payload.chatId}`;
  }
  if (
    (payload.type === 'icebreaker.match' || payload.type === 'match.request') &&
    payload.matchId
  ) {
    return `/match/${payload.matchId}`;
  }
  if (payload.type === 'icebreaker.interest') {
    return '/(tabs)/icebreaker';
  }
  return null;
}

export function navigateFromNotification(
  router: { push: (href: Href) => void },
  payload: NotificationNavigationPayload,
) {
  const href = getNotificationHref(payload);
  if (href) {
    router.push(href);
  }
}
