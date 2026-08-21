import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'pingme_access_token';
const REFRESH_TOKEN_KEY = 'pingme_refresh_token';
const USER_KEY = 'pingme_cached_user';

function slimCachedUser(user: unknown) {
  if (!user || typeof user !== 'object') return user;
  const record = user as Record<string, unknown>;
  const reputation = record.reputation;
  if (!reputation || typeof reputation !== 'object' || Array.isArray(reputation)) {
    return user;
  }
  const { recentEvents: _recentEvents, ...reputationRest } = reputation as Record<string, unknown>;
  return { ...record, reputation: reputationRest };
}

export async function saveTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function saveCachedUser(user: unknown) {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(slimCachedUser(user)));
}

export async function getCachedUser(): Promise<unknown | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
