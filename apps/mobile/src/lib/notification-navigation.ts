import type { Href } from 'expo-router';
import { setIcebreakerNearbyPrompt } from '../stores/icebreaker-nearby-prompt-store';

export type NotificationNavigationPayload = {
  type: string;
  title?: string;
  body?: string;
  postId?: string;
  replyId?: string;
  matchId?: string;
  chatId?: string;
  nearbyCount?: number;
  eventId?: string;
};

function parseNearbyCount(value: unknown): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return Math.floor(parsed);
}

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
    nearbyCount: parseNearbyCount(data.count),
    eventId: data.eventId != null ? String(data.eventId) : undefined,
  };
}

export function shouldSuppressIncomingBanner(
  pathname: string,
  payload: NotificationNavigationPayload,
): boolean {
  if (payload.chatId && pathname.includes(`/chat/${payload.chatId}`)) return true;
  if (payload.postId && pathname.includes(`/post/${payload.postId}`)) return true;
  if (payload.type === 'icebreaker.interest' && pathname.includes('icebreaker')) return true;
  if (payload.type === 'icebreaker.nearby' && pathname.includes('icebreaker')) return true;
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
  if (
    (payload.type === 'wall.reply.on_post' || payload.type === 'wall.reply.on_thread') &&
    payload.postId
  ) {
    return `/post/${payload.postId}`;
  }
  if (payload.type === 'chat.message' && payload.chatId) {
    return `/chat/${payload.chatId}`;
  }
  if (payload.type === 'match.request' && payload.chatId) {
    return `/chat/${payload.chatId}`;
  }
  if (
    (payload.type === 'icebreaker.match' || payload.type === 'match.request') &&
    payload.matchId
  ) {
    return `/match/${payload.matchId}`;
  }
  if (payload.type === 'verification.passed') {
    return '/(tabs)/profile';
  }
  if (payload.type === 'moderation.action') {
    return '/settings';
  }
  if (payload.type === 'icebreaker.interest' || payload.type === 'icebreaker.nearby') {
    return '/(tabs)/icebreaker';
  }
  if (payload.type === 'event.nearby') {
    return payload.eventId ? `/events/${payload.eventId}` : '/(tabs)/events';
  }
  if (payload.type === 'event.comment.reply' && payload.eventId) {
    return `/events/${payload.eventId}`;
  }
  if (payload.type === 'event.rsvp.withdrawal' && payload.eventId) {
    return `/events/${payload.eventId}`;
  }
  return null;
}

export function navigateFromNotification(
  router: { push: (href: Href) => void },
  payload: NotificationNavigationPayload,
) {
  if (payload.type === 'icebreaker.nearby') {
    setIcebreakerNearbyPrompt(payload.nearbyCount ?? 1);
  }

  const href = getNotificationHref(payload);
  if (href) {
    router.push(href);
  }
}
