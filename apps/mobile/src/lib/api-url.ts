import Constants from 'expo-constants';

const STAGING_API_URL = 'https://pingme.hostyler.cloud/v1';
const STAGING_WS_URL = 'wss://pingme.hostyler.cloud/ws';
const STAGING_INVITE_URL = 'https://pingme.hostyler.cloud';

function extraString(key: string): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const value = extra?.[key];
  return typeof value === 'string' ? value : undefined;
}

/** API base URL (includes /v1). Resolved at runtime from OTA expo config when env is missing. */
export function getApiUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? extraString('apiUrl') ?? STAGING_API_URL;
}

export function getWsUrl(): string | undefined {
  return process.env.EXPO_PUBLIC_WS_URL ?? extraString('wsUrl') ?? STAGING_WS_URL;
}

/** Public invite / marketing site (no /v1). */
export function getInviteUrl(): string {
  return process.env.EXPO_PUBLIC_INVITE_URL ?? extraString('inviteUrl') ?? STAGING_INVITE_URL;
}
