import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './auth-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

function isAccessTokenExpired(token: string, skewSeconds = 30) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { exp?: number };
    if (!payload.exp) return true;
    return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
  } catch {
    return true;
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.status === 401 || response.status === 403) {
      await clearTokens();
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    await saveTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

export async function ensureValidAccessToken() {
  const accessToken = await getAccessToken();
  const refreshToken = await getRefreshToken();

  if (!accessToken && !refreshToken) {
    return false;
  }

  if (accessToken && !isAccessTokenExpired(accessToken)) {
    return true;
  }

  if (!refreshToken) {
    return false;
  }

  return (await refreshAccessToken()) !== null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const accessToken = await getAccessToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch<T>(path, options, false);
    }
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      body?.error?.message ?? body?.message ?? 'Request failed',
      response.status,
      body?.error?.code ?? body?.code,
    );
  }

  return body as T;
}

export async function uploadAvatarFile(key: string, uri: string, fileName: string) {
  const accessToken = await getAccessToken();
  const formData = new FormData();
  formData.append('key', key);
  formData.append('file', {
    uri,
    name: fileName,
    type: 'image/jpeg',
  } as unknown as Blob);

  const response = await fetch(`${API_URL}/media/upload`, {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: formData,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      body?.error?.message ?? body?.message ?? 'Avatar upload failed',
      response.status,
      body?.error?.code ?? body?.code,
    );
  }

  return body;
}

export const api = {
  register: (payload: {
    email?: string;
    phone?: string;
    password: string;
    dateOfBirth: string;
    gender: 'male' | 'female' | 'transgender' | 'other';
    displayName?: string;
  }) =>
    apiFetch<{
      user: unknown;
      accessToken: string;
      refreshToken: string;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email?: string; phone?: string; password: string }) =>
    apiFetch<{
      user: unknown;
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: (refreshToken?: string) =>
    apiFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  me: () => apiFetch<{ success: boolean; data: AuthUser }>('/users/me'),

  updateProfile: (payload: {
    displayName?: string;
    bio?: string;
    dateOfBirth?: string;
    gender?: 'male' | 'female' | 'transgender' | 'other';
    avatarTheme?: 'aurora' | 'sunset' | 'midnight' | 'forest';
  }) =>
    apiFetch<{
      success: boolean;
      data: {
        displayName: string;
        bio?: string | null;
        gender?: 'male' | 'female' | 'transgender' | 'other' | null;
        avatarUrl?: string | null;
        avatarConfig?: { theme?: string } | null;
      };
    }>('/users/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  uploadAvatarBase64: (payload: { key: string; contentType: string; data: string }) =>
    apiFetch('/media/upload-base64', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  sendEmailOtp: () => apiFetch('/auth/verify-email/send', { method: 'POST' }),

  verifyEmail: (code: string) =>
    apiFetch('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  sendPhoneOtp: () => apiFetch('/auth/verify-phone/send', { method: 'POST' }),

  verifyPhone: (code: string) =>
    apiFetch('/auth/verify-phone', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  forgotPassword: (payload: { email?: string; phone?: string }) =>
    apiFetch<{ success: boolean; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  resetPassword: (payload: { token: string; password: string }) =>
    apiFetch<{ success: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  presignAvatar: (payload: { fileName: string; contentType: string }) =>
    apiFetch<{
      success: boolean;
      data: {
        uploadUrl: string | null;
        key: string;
        directUpload?: boolean;
        message?: string;
        publicUrl?: string;
      };
    }>('/media/presign', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  confirmAvatar: (payload: { key: string }) =>
    apiFetch<{ success: boolean; data: { avatarUrl: string | null } }>('/media/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  markChatRead: (chatId: string, messageIds?: string[]) =>
    apiFetch(`/chats/${chatId}/read`, {
      method: 'POST',
      body: JSON.stringify({ messageIds }),
    }),

  startVerification: () =>
    apiFetch<{
      success: boolean;
      data: {
        verificationUrl: string;
        sessionId: string;
        status: string;
        resumed: boolean;
      };
    }>('/verification/start', { method: 'POST' }),

  getVerificationStatus: () =>
    apiFetch<{
      success: boolean;
      data: {
        livenessVerified: boolean;
        enforcementEnabled: boolean;
        status: string | null;
        verificationUrl: string | null;
        rejectionReason: string | null;
        sessionId: string | null;
      };
    }>('/verification/status'),

  pingLocation: (payload: { latitude: number; longitude: number; accuracy?: number }) =>
    apiFetch('/presence/ping', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  setAvailable: (isAvailable: boolean) =>
    apiFetch<{ success: boolean; data: { isAvailable: boolean } }>('/presence/available', {
      method: 'POST',
      body: JSON.stringify({ isAvailable }),
    }),

  getPresenceStatus: () =>
    apiFetch<{
      success: boolean;
      data: {
        isAvailable: boolean;
        lastPingAt: string | null;
      };
    }>('/presence/status'),

  getNearbyCount: () =>
    apiFetch<{ success: boolean; data: { count: number; radiusMeters: number } }>(
      '/presence/nearby-count',
    ),

  getNearbyUsers: () =>
    apiFetch<{
      success: boolean;
      data: {
        users: NearbyAvailableUser[];
        radiusMeters: number;
      };
    }>('/presence/nearby'),

  getWallPosts: (page = 1) =>
    apiFetch<{ success: boolean; data: WallPost[]; meta: { page: number; limit: number } }>(
      `/wall/posts?page=${page}`,
    ),

  createWallPost: (payload: {
    content: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    showPhoto?: boolean;
  }) =>
    apiFetch('/wall/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getWallPost: (id: string) =>
    apiFetch<{ success: boolean; data: WallPostDetail }>(`/wall/posts/${id}`),

  replyToPost: (postId: string, content: string) =>
    apiFetch(`/wall/posts/${postId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  deleteWallPost: (postId: string) =>
    apiFetch<{ success: boolean }>(`/wall/posts/${postId}`, {
      method: 'DELETE',
    }),

  registerDevice: (payload: {
    platform: 'ios' | 'android';
    pushToken: string;
    deviceId?: string;
    deviceModel?: string;
    osVersion?: string;
    userAgent?: string;
    appVersion?: string;
  }) =>
    apiFetch('/devices/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSettings: () =>
    apiFetch<{
      success: boolean;
      data: UserSettings;
    }>('/users/me/settings'),

  getAppConfig: () =>
    apiFetch<{
      success: boolean;
      data: AppConfig;
    }>('/config'),

  getSubscription: () =>
    apiFetch<{ success: boolean; data: SubscriptionInfo }>('/subscriptions/me'),

  getSubscriptionPlans: () =>
    apiFetch<{ success: boolean; data: SubscriptionPlansResponse }>('/subscriptions/plans'),

  startSubscriptionCheckout: () =>
    apiFetch<{
      success: boolean;
      data: {
        checkoutUrl: string | null;
        sessionId?: string | null;
        provider?: string | null;
        inAppCheckout?: boolean;
      };
    }>('/subscriptions/checkout', {
      method: 'POST',
    }),

  confirmSubscriptionCheckout: (sessionId: string) =>
    apiFetch<{ success: boolean; data: SubscriptionInfo }>('/subscriptions/checkout/confirm', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }),

  cancelSubscription: () =>
    apiFetch<{ success: boolean; data: SubscriptionInfo }>('/subscriptions/cancel', {
      method: 'POST',
    }),

  updateSettings: (payload: Partial<UserSettings>) =>
    apiFetch<{ success: boolean; data: UserSettings }>('/users/me/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  startIcebreaker: (payload?: { showPhoto?: boolean; introMessage?: string }) =>
    apiFetch<{
      success: boolean;
      data: {
        id: string;
        status: string;
        expiresAt: string;
        showPhoto: boolean;
        introMessage: string | null;
      };
    }>('/icebreaker/start', {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),

  cancelIcebreaker: () => apiFetch('/icebreaker/cancel', { method: 'POST' }),

  getIcebreakerStatus: () =>
    apiFetch<{
      success: boolean;
      data: {
        session: {
          id: string;
          status: string;
          expiresAt: string;
          matchedSessionId?: string | null;
          showPhoto?: boolean;
          introMessage?: string | null;
        } | null;
        unanswered: IcebreakerUnansweredNotice[];
      };
    }>('/icebreaker/status'),

  acknowledgeIcebreakerUnanswered: (payload: { interestIds: string[] }) =>
    apiFetch('/icebreaker/acknowledge-unanswered', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getIcebreakerNearby: () =>
    apiFetch<{ success: boolean; data: IcebreakerNearbyUser[] }>('/icebreaker/nearby'),

  setIcebreakerInterest: (payload: { targetUserId: string; interested: boolean }) =>
    apiFetch<{
      success: boolean;
      data: { matched: boolean; matchId?: string; waiting?: boolean };
    }>('/icebreaker/interest', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMatches: () =>
    apiFetch<{ success: boolean; data: MatchSummary[] }>('/matches'),

  getMatch: (id: string) =>
    apiFetch<{ success: boolean; data: MatchDetail }>(`/matches/${id}`),

  acceptMatch: (id: string) =>
    apiFetch<{ success: boolean; data: MatchDetail }>(`/matches/${id}/accept`, {
      method: 'POST',
    }),

  declineMatch: (id: string) =>
    apiFetch<{ success: boolean; data: MatchDetail }>(`/matches/${id}/decline`, {
      method: 'POST',
    }),

  requestMatch: (payload: { source: 'wall_reply'; sourceReferenceId: string }) =>
    apiFetch<{ success: boolean; data: MatchDetail }>('/matches/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getChats: () => apiFetch<{ success: boolean; data: ChatSummary[] }>('/chats'),

  getChat: (id: string) => apiFetch<{ success: boolean; data: ChatDetail }>(`/chats/${id}`),

  getChatMessages: (chatId: string, page = 1) =>
    apiFetch<{ success: boolean; data: ChatMessage[]; meta: { page: number; limit: number } }>(
      `/chats/${chatId}/messages?page=${page}`,
    ),

  sendMessage: (chatId: string, content: string) =>
    apiFetch<{ success: boolean; data: ChatMessage }>(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  closeChat: (chatId: string) =>
    apiFetch(`/chats/${chatId}/close`, { method: 'POST' }),

  blockUser: (userId: string) =>
    apiFetch('/blocks', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  unblockUser: (userId: string) => apiFetch(`/blocks/${userId}`, { method: 'DELETE' }),

  getBlockedUsers: () =>
    apiFetch<{
      success: boolean;
      data: Array<{ userId: string; displayName: string; blockedAt: string }>;
    }>('/blocks'),

  reportUser: (payload: {
    reportedUserId: string;
    targetType: 'user' | 'post' | 'reply' | 'message';
    targetId: string;
    reason: 'harassment' | 'spam' | 'inappropriate' | 'underage' | 'other';
    description?: string;
  }) =>
    apiFetch('/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export interface PublicUserFlair {
  isPremium?: boolean;
  avatarTheme?: string | null;
  livenessVerified?: boolean;
}

export interface NearbyAvailableUser extends PublicUserFlair {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  distanceBucket: string;
}

export interface IcebreakerUnansweredNotice {
  interestId: string;
  targetUserId: string;
  displayName: string;
  expiredAt: string;
}

export interface IcebreakerNearbyUser extends PublicUserFlair {
  userId: string;
  sessionId: string;
  displayName: string;
  avatarUrl: string | null;
  introMessage: string | null;
  distanceBucket: string;
  myResponse: 'yes' | null;
  interestedInMe: boolean;
  highlight: 'mutual_match' | 'interested_in_you' | null;
  matchId: string | null;
  activeNow?: boolean;
}

export interface WallPost {
  id: string;
  content: string;
  replyCount: number;
  createdAt: string;
  distanceBucket: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    isYou: boolean;
    isPremium?: boolean;
    avatarTheme?: string | null;
    livenessVerified?: boolean;
  };
}

export interface WallPostDetail extends WallPost {
  replies: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      displayName: string;
      avatarUrl?: string | null;
      isYou: boolean;
      isPremium?: boolean;
      avatarTheme?: string | null;
      livenessVerified?: boolean;
    };
  }>;
}

export interface AuthUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  livenessVerified?: boolean;
  profile?: {
    displayName: string;
    bio?: string | null;
    dateOfBirth: string;
    gender?: 'male' | 'female' | 'transgender' | 'other' | null;
    avatarUrl?: string | null;
    avatarConfig?: { theme?: string } | null;
  } | null;
  subscription?: SubscriptionInfo;
}

export interface SubscriptionInfo {
  plan: 'free' | 'premium';
  status: string;
  isPremium: boolean;
  paymentProvider: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  features: {
    avatarThemes: boolean;
    readReceipts: boolean;
    profileFlair: boolean;
  };
}

export interface AppConfig {
  version: 1;
  distance: {
    wall: {
      defaultMeters: number;
      minMeters: number;
      maxMeters: number;
      pickerOptionsMeters: number[];
    };
    icebreaker: {
      radiusMeters: number;
      startsPerHour: number;
      windowMinutes: number;
      hideMinutes: number;
      interestExpiryMinutes: number;
    };
    events: {
      discoveryRadiusMeters: number;
    };
  };
}

export interface SubscriptionPlansResponse {
  paymentsEnabled: boolean;
  paymentProvider: string | null;
  plans: Array<{
    id: string;
    name: string;
    priceLabel: string;
    features: string[];
  }>;
  premiumThemes: Array<{
    id: string;
    label: string;
    colors: string[];
  }>;
}

export interface UserSettings {
  quietMode: boolean;
  allowPushReplies: boolean;
  allowPushChat: boolean;
  allowPushIcebreaker: boolean;
  showReadReceipts: boolean;
  radiusMeters: number;
  showDistanceBucket: boolean;
  language: string;
}

export interface MatchOtherUser {
  id?: string;
  displayName?: string;
  avatarUrl?: string | null;
  isPremium?: boolean;
  avatarTheme?: string | null;
  livenessVerified?: boolean;
  activeNow?: boolean;
  anonymous: boolean;
  label: string;
}

export interface MatchSummary {
  id: string;
  source: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  chatId: string | null;
  myAccepted: boolean;
  theirAccepted: boolean;
  otherUser: MatchOtherUser;
}

export interface MatchDetail extends MatchSummary {
  youAccepted: boolean;
  theyAccepted: boolean;
}

export interface ChatSummary {
  id: string;
  matchId: string;
  status: string;
  otherUser: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    isPremium?: boolean;
    avatarTheme?: string | null;
    livenessVerified?: boolean;
  };
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    isYou: boolean;
  } | null;
  unreadCount?: number;
  createdAt: string;
}

export interface ChatDetail {
  id: string;
  matchId: string;
  status: string;
  otherUser: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    isPremium?: boolean;
    avatarTheme?: string | null;
    livenessVerified?: boolean;
  };
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  isYou: boolean;
  status: string;
  read?: boolean;
}
