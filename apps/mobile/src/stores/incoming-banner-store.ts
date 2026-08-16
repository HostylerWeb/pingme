import { create } from 'zustand';
import type { AppIconName } from '../components/ui/app-icon';
import type { NotificationNavigationPayload } from '../lib/notification-navigation';

export type IncomingBanner = {
  title: string;
  body: string;
  icon: AppIconName;
  payload: NotificationNavigationPayload | null;
};

interface IncomingBannerState {
  banner: IncomingBanner | null;
  show: (banner: IncomingBanner) => void;
  hide: () => void;
}

export const useIncomingBannerStore = create<IncomingBannerState>((set) => ({
  banner: null,
  show: (banner) => set({ banner }),
  hide: () => set({ banner: null }),
}));

export function showIncomingBanner(banner: IncomingBanner) {
  useIncomingBannerStore.getState().show(banner);
}

export function iconForNotificationType(type: string): AppIconName {
  if (type === 'wall.reply') return 'wall';
  if (type === 'chat.message') return 'chats';
  if (
    type === 'icebreaker.interest' ||
    type === 'icebreaker.nearby' ||
    type === 'icebreaker.match' ||
    type === 'match.request'
  ) {
    return 'icebreaker';
  }
  return 'notifications';
}
