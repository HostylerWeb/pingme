import { Share } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

/** Public marketing / invite page (no /v1). */
export function getInviteWebBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_INVITE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return API_URL.replace(/\/v1\/?$/, '');
}

export function buildInviteWebUrl(referrerUserId?: string): string {
  const base = getInviteWebBaseUrl();
  if (!referrerUserId) {
    return `${base}/invite`;
  }
  return `${base}/invite?ref=${encodeURIComponent(referrerUserId)}`;
}

export function buildInviteDeepLink(referrerUserId?: string): string {
  if (!referrerUserId) {
    return 'pingme://invite';
  }
  return `pingme://invite?ref=${encodeURIComponent(referrerUserId)}`;
}

export function buildInviteShareMessage(referrerUserId?: string): string {
  const link = buildInviteWebUrl(referrerUserId);
  return `Join me on PingMe — meet people nearby on the Wall and Break the ice.\n\n${link}`;
}

export async function shareAppInvite(referrerUserId?: string) {
  const message = buildInviteShareMessage(referrerUserId);
  const url = buildInviteWebUrl(referrerUserId);

  await Share.share({
    message,
    url,
    title: 'Invite to PingMe',
  });
}
