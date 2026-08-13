import { create } from 'zustand';
import { api, AuthUser } from '../lib/api';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '../lib/auth-storage';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    dateOfBirth: string;
    displayName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isHydrated: false,

  hydrate: async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        set({ user: null, isHydrated: true });
        return;
      }
      const response = await api.me();
      set({ user: response.data, isHydrated: true });
    } catch {
      await clearTokens();
      set({ user: null, isHydrated: true });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const result = await api.login({ email, password });
      await saveTokens(result.accessToken, result.refreshToken);
      set({ user: result.user as AuthUser, isLoading: false });
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
      set({ user: result.user as AuthUser, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    const refreshToken = (await getRefreshToken()) ?? undefined;
    try {
      await api.logout(refreshToken);
    } finally {
      await clearTokens();
      set({ user: null });
    }
  },

  refreshMe: async () => {
    const response = await api.me();
    set({ user: response.data });
  },
}));
