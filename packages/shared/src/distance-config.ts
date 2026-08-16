export type DistanceConfig = {
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

export type AppConfigPayload = {
  version: 1;
  distance: DistanceConfig;
  privacyPolicyUrl: string;
  termsOfServiceUrl: string;
};

export type DistanceEnvInput = {
  wallDefaultMeters?: string | number | null;
  wallMinMeters?: string | number | null;
  wallMaxMeters?: string | number | null;
  icebreakerRadiusMeters?: string | number | null;
  icebreakerStartsPerHour?: string | number | null;
  icebreakerWindowMinutes?: string | number | null;
  icebreakerHideMinutes?: string | number | null;
  icebreakerInterestExpiryMinutes?: string | number | null;
  eventsDiscoveryRadiusMeters?: string | number | null;
};

function parseRequiredPositiveInt(
  value: string | number | null | undefined,
  label: string,
): number {
  if (value === null || value === undefined || value === '') {
    throw new Error(`${label} is required`);
  }
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

export function clampWallRadius(
  meters: number,
  minMeters: number,
  maxMeters: number,
): number {
  return Math.min(maxMeters, Math.max(minMeters, Math.round(meters)));
}

export function buildWallRadiusOptions(
  minMeters: number,
  maxMeters: number,
  defaultMeters: number,
): number[] {
  const defaultClamped = clampWallRadius(defaultMeters, minMeters, maxMeters);
  const roundStep = (value: number) => {
    const step = maxMeters - minMeters >= 400 ? 50 : 25;
    return Math.round(value / step) * step;
  };

  const candidates = [
    minMeters,
    roundStep((minMeters + defaultClamped) / 2),
    defaultClamped,
    roundStep((defaultClamped + maxMeters) / 2),
    maxMeters,
  ].map((value) => clampWallRadius(value, minMeters, maxMeters));

  return [...new Set(candidates)].sort((a, b) => a - b);
}

export function parseDistanceConfigFromEnv(input: DistanceEnvInput): DistanceConfig {
  if (
    input.wallDefaultMeters === null ||
    input.wallDefaultMeters === undefined ||
    input.wallDefaultMeters === ''
  ) {
    throw new Error('WALL_DEFAULT_RADIUS_METERS / DEFAULT_RADIUS_METERS is required');
  }

  const wallDefaultMeters = parseRequiredPositiveInt(
    input.wallDefaultMeters,
    'WALL_DEFAULT_RADIUS_METERS / DEFAULT_RADIUS_METERS',
  );
  let wallMinMeters = parseRequiredPositiveInt(
    input.wallMinMeters,
    'WALL_MIN_RADIUS_METERS',
  );
  let wallMaxMeters = parseRequiredPositiveInt(
    input.wallMaxMeters,
    'WALL_MAX_RADIUS_METERS',
  );

  if (wallMinMeters > wallMaxMeters) {
    [wallMinMeters, wallMaxMeters] = [wallMaxMeters, wallMinMeters];
  }

  const wallDefaultClamped = clampWallRadius(wallDefaultMeters, wallMinMeters, wallMaxMeters);

  const icebreakerRadiusMeters = parseRequiredPositiveInt(
    input.icebreakerRadiusMeters,
    'ICEBREAKER_RADIUS_METERS',
  );
  const icebreakerStartsPerHour = parseRequiredPositiveInt(
    input.icebreakerStartsPerHour,
    'ICEBREAKER_STARTS_PER_HOUR',
  );
  const icebreakerWindowMinutes = parseRequiredPositiveInt(
    input.icebreakerWindowMinutes,
    'ICEBREAKER_WINDOW_MINUTES',
  );
  const icebreakerHideMinutes = parseRequiredPositiveInt(
    input.icebreakerHideMinutes,
    'ICEBREAKER_HIDE_MINUTES',
  );
  const icebreakerInterestExpiryMinutes = parseRequiredPositiveInt(
    input.icebreakerInterestExpiryMinutes,
    'ICEBREAKER_INTEREST_EXPIRY_MINUTES',
  );

  const eventsDiscoveryRadiusMeters = parseRequiredPositiveInt(
    input.eventsDiscoveryRadiusMeters,
    'EVENTS_DISCOVERY_RADIUS_METERS',
  );

  return {
    wall: {
      defaultMeters: wallDefaultClamped,
      minMeters: wallMinMeters,
      maxMeters: wallMaxMeters,
      pickerOptionsMeters: buildWallRadiusOptions(
        wallMinMeters,
        wallMaxMeters,
        wallDefaultClamped,
      ),
    },
    icebreaker: {
      radiusMeters: icebreakerRadiusMeters,
      startsPerHour: icebreakerStartsPerHour,
      windowMinutes: icebreakerWindowMinutes,
      hideMinutes: icebreakerHideMinutes,
      interestExpiryMinutes: icebreakerInterestExpiryMinutes,
    },
    events: {
      discoveryRadiusMeters: eventsDiscoveryRadiusMeters,
    },
  };
}

export function buildAppConfigPayload(
  distance: DistanceConfig,
  legal?: { privacyPolicyUrl?: string; termsOfServiceUrl?: string },
): AppConfigPayload {
  return {
    version: 1,
    distance,
    privacyPolicyUrl: legal?.privacyPolicyUrl ?? '',
    termsOfServiceUrl: legal?.termsOfServiceUrl ?? '',
  };
}

export function wallRadiusRangeLabel(minMeters: number, maxMeters: number): string {
  return `${minMeters}–${maxMeters}m`;
}

export function icebreakerRadiusLabel(radiusMeters: number): string {
  return `Within ${radiusMeters}m radius`;
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes === 1) {
    return '1 min';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  return `${minutes} min`;
}

export function formatEventsDiscoveryRadius(meters: number): string {
  if (meters >= 1000 && meters % 1000 === 0) {
    return `${meters / 1000} km`;
  }
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters} m`;
}
