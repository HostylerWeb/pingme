import { ACTIVE_NOW_THRESHOLD_MINUTES } from './constants';

export { icebreakerRadiusLabel } from './distance-config';

export function fuzzyCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function distanceBucket(meters: number): string {
  if (meters < 100) return 'very_near';
  if (meters < 200) return '~200m';
  if (meters < 300) return '~300m';
  return 'nearby';
}

export function distanceLabel(bucket: string): string {
  switch (bucket) {
    case 'very_near':
      return 'Very near';
    case '~200m':
      return '~200m away';
    case '~300m':
      return '~300m away';
    default:
      return 'Nearby';
  }
}
export function isUserActiveNow(
  lastSeenAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastSeenAt) return false;
  const seen = typeof lastSeenAt === 'string' ? new Date(lastSeenAt) : lastSeenAt;
  if (Number.isNaN(seen.getTime())) return false;
  return now.getTime() - seen.getTime() <= ACTIVE_NOW_THRESHOLD_MINUTES * 60 * 1000;
}
