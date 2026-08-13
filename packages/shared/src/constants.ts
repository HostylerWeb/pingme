export const DEFAULT_RADIUS_METERS = 250;
export const MIN_RADIUS_METERS = 150;
export const MAX_RADIUS_METERS = 500;
export const ICEBREAKER_RADIUS_METERS = 50;
export const ICEBREAKER_WINDOW_MINUTES = 10;
export const MATCH_EXPIRY_MINUTES = 30;
export const ICEBREAKER_STARTS_PER_HOUR = 5;
export const PRESENCE_TTL_SECONDS = 300;
export const BACKGROUND_PING_INTERVAL_MS = 180_000;

export const NOTIFICATION_TYPES = {
  WALL_REPLY: 'wall.reply',
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
