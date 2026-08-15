import { Global, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppConfigPayload,
  buildAppConfigPayload,
  clampWallRadius,
  parseDistanceConfigFromEnv,
  type DistanceConfig,
} from '@pingme/shared';

@Global()
@Injectable()
export class AppConfigService {
  private readonly distance: DistanceConfig;

  constructor(private readonly config: ConfigService) {
    this.distance = parseDistanceConfigFromEnv({
      wallDefaultMeters:
        this.config.get<string>('WALL_DEFAULT_RADIUS_METERS') ??
        this.config.get<string>('DEFAULT_RADIUS_METERS'),
      wallMinMeters: this.config.get<string>('WALL_MIN_RADIUS_METERS'),
      wallMaxMeters: this.config.get<string>('WALL_MAX_RADIUS_METERS'),
      icebreakerRadiusMeters: this.config.get<string>('ICEBREAKER_RADIUS_METERS'),
      icebreakerStartsPerHour: this.config.get<string>('ICEBREAKER_STARTS_PER_HOUR'),
      icebreakerWindowMinutes: this.config.get<string>('ICEBREAKER_WINDOW_MINUTES'),
      icebreakerHideMinutes: this.config.get<string>('ICEBREAKER_HIDE_MINUTES'),
      icebreakerInterestExpiryMinutes: this.config.get<string>(
        'ICEBREAKER_INTEREST_EXPIRY_MINUTES',
      ),
      eventsDiscoveryRadiusMeters: this.config.get<string>('EVENTS_DISCOVERY_RADIUS_METERS'),
    });
  }

  getIcebreakerConfig(): DistanceConfig['icebreaker'] {
    return this.distance.icebreaker;
  }

  getDistanceConfig(): DistanceConfig {
    return this.distance;
  }

  getAppConfig(): AppConfigPayload {
    return buildAppConfigPayload(this.distance);
  }

  resolveWallRadius(userRadiusMeters?: number | null): number {
    if (userRadiusMeters == null) {
      return this.distance.wall.defaultMeters;
    }
    return clampWallRadius(
      userRadiusMeters,
      this.distance.wall.minMeters,
      this.distance.wall.maxMeters,
    );
  }

  clampWallRadius(userRadiusMeters: number): number {
    return clampWallRadius(
      userRadiusMeters,
      this.distance.wall.minMeters,
      this.distance.wall.maxMeters,
    );
  }
}
