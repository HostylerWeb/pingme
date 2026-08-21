/**
 * Reputation rules — single source of truth for API + mobile.
 * Edit values here to change tiers, earn amounts, and caps.
 */

export const REPUTATION_SCORE_MIN = 0;
export const REPUTATION_SCORE_MAX = 1500;

/** Combined daily cap for wall + icebreaker activity points. */
export const REPUTATION_DAILY_ACTIVITY_CAP = 6;

export type ReputationTierId = 'new' | 'regular' | 'respected' | 'trusted' | 'master';

export type ReputationEventSourceType =
  | 'verification_liveness'
  | 'verification_id'
  | 'verification_email'
  | 'verification_phone'
  | 'activity_first_wall_post'
  | 'activity_wall'
  | 'activity_icebreaker_match'
  | 'activity_weekly_streak'
  | 'activity_account_age'
  | 'activity_event_host'
  | 'activity_event_attend'
  | 'report_deduction'
  | 'report_reporter_penalty'
  | 'admin_adjustment';

/** Minimum score required to reach each tier (tier 1 starts at 0). */
export const REPUTATION_TIER_THRESHOLDS: Record<ReputationTierId, number> = {
  new: 0,
  regular: 200,
  respected: 450,
  trusted: 700,
  master: 1000,
};

export const REPUTATION_TIER_ORDER: ReputationTierId[] = [
  'new',
  'regular',
  'respected',
  'trusted',
  'master',
];

export const REPUTATION_TIER_LABELS: Record<ReputationTierId, string> = {
  new: 'New',
  regular: 'Regular',
  respected: 'Respected',
  trusted: 'Trusted',
  master: 'Master',
};

/** One-time verification / onboarding bonuses. */
export const REPUTATION_EARN_ONE_TIME: Partial<Record<ReputationEventSourceType, number>> = {
  verification_liveness: 50,
  verification_id: 50,
  verification_email: 5,
  verification_phone: 5,
  activity_first_wall_post: 5,
};

/** Recurring earn amounts (subject to per-source daily caps where noted). */
export const REPUTATION_EARN_RECURRING: Partial<Record<ReputationEventSourceType, number>> = {
  activity_wall: 1,
  activity_icebreaker_match: 3,
  activity_weekly_streak: 4,
  activity_account_age: 2,
  activity_event_host: 8,
  activity_event_attend: 3,
};

/** Per-source daily caps (only sources listed here). */
export const REPUTATION_DAILY_SOURCE_CAPS: Partial<Record<ReputationEventSourceType, number>> = {
  activity_wall: 2,
  activity_icebreaker_match: 4,
};

/** Sources counted toward the combined daily activity cap. */
export const REPUTATION_DAILY_ACTIVITY_SOURCES: ReputationEventSourceType[] = [
  'activity_wall',
  'activity_icebreaker_match',
];

/** Admin quick-pick deduction amounts on report resolve/dismiss. */
export const REPUTATION_ADMIN_QUICK_DEDUCTIONS = [3, 5, 7, 10] as const;

export function clampReputationScore(score: number): number {
  return Math.min(REPUTATION_SCORE_MAX, Math.max(REPUTATION_SCORE_MIN, score));
}

export function getReputationTier(score: number): ReputationTierId {
  const clamped = clampReputationScore(score);
  let tier: ReputationTierId = 'new';
  for (const id of REPUTATION_TIER_ORDER) {
    if (clamped >= REPUTATION_TIER_THRESHOLDS[id]) {
      tier = id;
    }
  }
  return tier;
}

export function getReputationTierLabel(tier: ReputationTierId): string {
  return REPUTATION_TIER_LABELS[tier];
}

export function getNextReputationTier(tier: ReputationTierId): ReputationTierId | null {
  const index = REPUTATION_TIER_ORDER.indexOf(tier);
  if (index < 0 || index >= REPUTATION_TIER_ORDER.length - 1) {
    return null;
  }
  return REPUTATION_TIER_ORDER[index + 1] ?? null;
}

export function pointsToNextTier(score: number): number | null {
  const tier = getReputationTier(score);
  const next = getNextReputationTier(tier);
  if (!next) {
    const remainingToMax = REPUTATION_SCORE_MAX - clampReputationScore(score);
    return remainingToMax > 0 ? remainingToMax : null;
  }
  return REPUTATION_TIER_THRESHOLDS[next] - clampReputationScore(score);
}

export interface ReputationSummary {
  score: number;
  tier: ReputationTierId;
  tierLabel: string;
  pointsToNextTier: number | null;
  nextTier: ReputationTierId | null;
  nextTierLabel: string | null;
  scoreMax: number;
}

export function buildReputationSummary(score: number): ReputationSummary {
  const tier = getReputationTier(score);
  const nextTier = getNextReputationTier(tier);
  return {
    score: clampReputationScore(score),
    tier,
    tierLabel: getReputationTierLabel(tier),
    pointsToNextTier: pointsToNextTier(score),
    nextTier,
    nextTierLabel: nextTier ? getReputationTierLabel(nextTier) : null,
    scoreMax: REPUTATION_SCORE_MAX,
  };
}

export type ReputationExplainerItem = {
  label: string;
  points: string;
  note?: string;
};

export const REPUTATION_EXPLAINER_INTRO =
  'Reputation reflects how you show up on PingMe. Earn points through verification and positive activity. Reports and admin actions can reduce your score.';

export const REPUTATION_EXPLAINER_EARN: ReputationExplainerItem[] = [
  { label: 'Liveness verification', points: '+50', note: 'One time' },
  { label: 'ID verification', points: '+50', note: 'One time' },
  { label: 'Email verified', points: '+5', note: 'One time' },
  { label: 'Phone verified', points: '+5', note: 'One time' },
  { label: 'First Wall post', points: '+5', note: 'One time' },
  { label: 'Wall activity', points: '+1', note: 'Up to +2 per day' },
  { label: 'Icebreaker match', points: '+3', note: 'Up to +4 per day' },
  { label: 'Host an event', points: '+8', note: 'Once per event' },
  { label: 'Attend an event', points: '+3', note: 'Once per event, after it ends' },
];

export const REPUTATION_EXPLAINER_TIERS = REPUTATION_TIER_ORDER.map((tier) => ({
  tier,
  label: REPUTATION_TIER_LABELS[tier],
  minScore: REPUTATION_TIER_THRESHOLDS[tier],
}));

export const REPUTATION_EXPLAINER_DAILY_CAP =
  'Wall and Icebreaker activity share a combined daily cap of +6 points.';
