export const MATCH_EXPIRY_MINUTES = 30;
/** Wall posts older than this are hidden from the feed (and set as expires_at on create). */
export const WALL_POST_MAX_AGE_HOURS = 48;
/** Foreground location pings while Wall / Break the ice tabs are open (~1/min). */
export const LOCATION_PINGS_PER_HOUR = 120;
export const FOREGROUND_PING_INTERVAL_MS = 60_000;
export const MAX_ICEBREAKER_INTRO_LENGTH = 100;
export const ACTIVE_NOW_THRESHOLD_MINUTES = 3;
export const PRESENCE_TTL_SECONDS = 1800;
export const BACKGROUND_PING_INTERVAL_MS = 180_000;

export const NOTIFICATION_TYPES = {
  WALL_REPLY: 'wall.reply',
  ICEBREAKER_NEARBY: 'icebreaker.nearby',
  ICEBREAKER_INTEREST: 'icebreaker.interest',
  ICEBREAKER_MATCH: 'icebreaker.match',
  MATCH_REQUEST: 'match.request',
  CHAT_MESSAGE: 'chat.message',
  VERIFICATION_PASSED: 'verification.passed',
  MODERATION_ACTION: 'moderation.action',
  EVENT_NEARBY: 'event.nearby',
  EVENT_COMMENT_REPLY: 'event.comment.reply',
} as const;

export const MAX_EVENT_IMAGES = 5;
export const MAX_EVENT_GALLERY_IMAGES = 4;
export const MAX_EVENT_TITLE_LENGTH = 120;
export const MAX_EVENT_DESCRIPTION_LENGTH = 5000;
export const MAX_EVENT_COMMENT_LENGTH = 500;

export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MAX_BIO_LENGTH = 300;
export const MAX_WALL_POST_LENGTH = 500;
export const MAX_WALL_REPLY_LENGTH = 300;
export const MAX_MESSAGE_LENGTH = 2000;

export const MIN_AGE_YEARS = 18;

/** Reports against a user in this window that trigger admin review. */
export const REPORT_AUTO_FLAG_THRESHOLD = 3;
export const REPORT_AUTO_FLAG_WINDOW_HOURS = 24;

/** Days after scheduling before an account is permanently deleted. */
export const ACCOUNT_DELETION_GRACE_DAYS = 14;

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

export function genderSymbol(value: string | null | undefined): string | null {
  switch (value) {
    case 'male':
      return '♂';
    case 'female':
      return '♀';
    case 'transgender':
      return '⚧';
    case 'other':
      return '◆';
    default:
      return null;
  }
}

export const PREMIUM_PROSPECT_BENEFITS = [
  'Premium badge on your posts, replies, and Break the ice',
  'Gradient avatar ring others see on Wall and in chats',
  'Custom avatar themes',
  'Optional read receipts in chat',
] as const;

export const PREMIUM_MEMBER_BENEFITS = [
  'Your Premium star and ring appear on every Wall post, reply, and Break the ice card',
  'Gradient avatar ring on your profile and in chats',
  'Custom avatar themes',
  'Optional read receipts in chat',
] as const;

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
    features: [...PREMIUM_PROSPECT_BENEFITS],
  },
} as const;

export const PREMIUM_AVATAR_THEMES = [
  { id: 'aurora', label: 'Aurora', colors: ['#6366f1', '#8b5cf6', '#ec4899'] },
  { id: 'sunset', label: 'Sunset', colors: ['#f97316', '#ef4444', '#f59e0b'] },
  { id: 'midnight', label: 'Midnight', colors: ['#0f172a', '#1e3a8a', '#312e81'] },
  { id: 'forest', label: 'Forest', colors: ['#14532d', '#16a34a', '#84cc16'] },
] as const;

export type PremiumAvatarThemeId = (typeof PREMIUM_AVATAR_THEMES)[number]['id'];
