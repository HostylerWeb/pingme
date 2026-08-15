import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './app-config.service';

describe('AppConfigService', () => {
  it('reads distance limits from env', () => {
    const moduleRef = Test.createTestingModule({
      providers: [
        AppConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const values: Record<string, string> = {
                DEFAULT_RADIUS_METERS: '300',
                WALL_MIN_RADIUS_METERS: '200',
                WALL_MAX_RADIUS_METERS: '600',
                ICEBREAKER_RADIUS_METERS: '75',
                ICEBREAKER_STARTS_PER_HOUR: '7',
                ICEBREAKER_WINDOW_MINUTES: '12',
                ICEBREAKER_HIDE_MINUTES: '8',
                ICEBREAKER_INTEREST_EXPIRY_MINUTES: '15',
                EVENTS_DISCOVERY_RADIUS_METERS: '12000',
              };
              return values[key];
            },
          },
        },
      ],
    });

    return moduleRef.compile().then((module) => {
      const service = module.get(AppConfigService);
      expect(service.getDistanceConfig().wall.defaultMeters).toBe(300);
      expect(service.getDistanceConfig().icebreaker.radiusMeters).toBe(75);
      expect(service.getIcebreakerConfig().startsPerHour).toBe(7);
      expect(service.getIcebreakerConfig().windowMinutes).toBe(12);
      expect(service.getIcebreakerConfig().hideMinutes).toBe(8);
      expect(service.getIcebreakerConfig().interestExpiryMinutes).toBe(15);
      expect(service.getDistanceConfig().events.discoveryRadiusMeters).toBe(12_000);
      expect(service.resolveWallRadius(999)).toBe(600);
      expect(service.resolveWallRadius(null)).toBe(300);
    });
  });
});
