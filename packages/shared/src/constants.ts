export const DEFAULT_RADIUS_METERS = 250;
export const MIN_RADIUS_METERS = 150;
export const MAX_RADIUS_METERS = 500;
export const ICEBREAKER_RADIUS_METERS = 150;
export const ICEBREAKER_WINDOW_MINUTES = 10;
export const ICEBREAKER_HIDE_MINUTES = 10;
export const ICEBREAKER_INTEREST_EXPIRY_MINUTES = 10;
export const MATCH_EXPIRY_MINUTES = 30;
export const ICEBREAKER_STARTS_PER_HOUR = 5;
export const MAX_ICEBREAKER_INTRO_LENGTH = 100;
export const PRESENCE_TTL_SECONDS = 300;
export const BACKGROUND_PING_INTERVAL_MS = 180_000;

export const NOTIFICATION_TYPES = {
  WALL_REPLY: 'wall.reply',
  ICEBREAKER_INTEREST: 'icebreaker.interest',
  ICEBREAKER_MATCH: 'icebreaker.match',
  MATCH_REQUEST: 'match.request',
  CHAT_MESSAGE: 'chat.message',
  VERIFICATION_PASSED: 'verification.passed',
  MODERATION_ACTION: 'moderation.action',
} as const;

export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MAX_BIO_LENGTH = 300;
export const MAX_WALL_POST_LENGTH = 500;
export const MAX_WALL_REPLY_LENGTH = 300;
export const MAX_MESSAGE_LENGTH = 2000;

export const MIN_AGE_YEARS = 18;

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'transgender', label: 'Transgender' },
  { value: 'other', label: 'Other' },
] as const;

export type GenderValue = (typeof GENDER_OPTIONS)[number]['value'];

export function genderLabel(value: string | null | undefined): string {
  return GENDER_OPTIONS.find((option) => option.value === value)?.label ?? '—';
}

export const SUBSCRIPTION_PLANS = {
  free: {
    id: 'free' as const,
    name: 'Free',
    priceLabel: '$0',
    features: ['Nearby wall', 'Replies & chat', 'Break the ice'],
  },
  premium: {
    id: 'premium' as const,
    name: 'Premium',
    priceLabel: 'Coming soon',
    features: ['Custom avatar themes', 'Read receipts', 'Profile flair'],
  },
} as const;

export const PREMIUM_AVATAR_THEMES = [
  { id: 'aurora', label: 'Aurora', colors: ['#6366f1', '#8b5cf6', '#ec4899'] },
  { id: 'sunset', label: 'Sunset', colors: ['#f97316', '#ef4444', '#f59e0b'] },
  { id: 'midnight', label: 'Midnight', colors: ['#0f172a', '#1e3a8a', '#312e81'] },
  { id: 'forest', label: 'Forest', colors: ['#14532d', '#16a34a', '#84cc16'] },
] as const;

export type PremiumAvatarThemeId = (typeof PREMIUM_AVATAR_THEMES)[number]['id'];
