import { create } from 'zustand';
import { api, AuthUser, ensureValidAccessToken, isAuthApiError } from '../lib/api';
import {
  clearTokens,
  getAccessToken,
  getCachedUser,
  getRefreshToken,
  saveCachedUser,
  saveTokens,
} from '../lib/auth-storage';
import { stopBackgroundLocation } from '../lib/background-location';
import { unregisterPushNotifications } from '../lib/push-notifications';
import { queryClient } from '../lib/query-client';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  login: (identifier: string, password: string, mode?: 'email' | 'phone') => Promise<void>;
  register: (input: {
    email?: string;
    phone?: string;
    password: string;
    dateOfBirth: string;
    gender: 'male' | 'female' | 'transgender' | 'other';
    displayName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isHydrated: false,

  hydrate: async () => {
    const accessToken = await getAccessToken();
    const refreshToken = await getRefreshToken();

    if (!accessToken && !refreshToken) {
      set({ user: null, isHydrated: true });
      return;
    }

    const cachedUser = (await getCachedUser()) as AuthUser | null;

    try {
      const hasValidAccess = await ensureValidAccessToken();
      if (!hasValidAccess) {
        await clearTokens();
        set({ user: null, isHydrated: true });
        return;
      }

      const response = await api.me();
      await saveCachedUser(response.data);
      set({ user: response.data, isHydrated: true });
    } catch (error) {
      if (isAuthApiError(error)) {
        await clearTokens();
        set({ user: null, isHydrated: true });
        return;
      }

      if (cachedUser) {
        set({ user: cachedUser, isHydrated: true });
        return;
      }

      set({ user: null, isHydrated: true });
    }
  },

  login: async (identifier, password, mode = 'email') => {
    set({ isLoading: true });
    try {
      const result = await api.login(
        mode === 'phone'
          ? { phone: identifier, password }
          : { email: identifier, password },
      );
      await saveTokens(result.accessToken, result.refreshToken);
      const user = result.user as AuthUser;
      await saveCachedUser(user);
      set({ user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (input) => {
    set({ isLoading: true });
    try {
      const result = await api.register(input);
      await saveTokens(result.accessToken, result.refreshToken);
      const user = result.user as AuthUser;
      await saveCachedUser(user);
      set({ user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await stopBackgroundLocation();
    } catch {
      // ignore
    }
    try {
      await unregisterPushNotifications();
    } catch {
      // ignore
    }

    const refreshToken = (await getRefreshToken()) ?? undefined;
    try {
      await api.logout(refreshToken);
    } finally {
      queryClient.clear();
      await clearTokens();
      set({ user: null });
    }
  },

  refreshMe: async () => {
    try {
      const response = await api.me();
      await saveCachedUser(response.data);
      set({ user: response.data });
    } catch (error) {
      if (isAuthApiError(error)) {
        await clearTokens();
        set({ user: null });
        return;
      }
      throw error;
    }
  },
}));
