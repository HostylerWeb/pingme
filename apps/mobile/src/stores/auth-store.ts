import { create } from 'zustand';
import { api, AuthUser } from '../lib/api';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '../lib/auth-storage';

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

  login: async (identifier, password, mode = 'email') => {
    set({ isLoading: true });
    try {
      const result = await api.login(
        mode === 'phone'
          ? { phone: identifier, password }
          : { email: identifier, password },
      );
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
