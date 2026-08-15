import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@pingme/db';
import {
  distanceBucket,
  fuzzyCoordinate,
  LOCATION_PINGS_PER_HOUR,
  PRESENCE_TTL_SECONDS,
} from '@pingme/shared';
import { BlocksService } from '../common/services/blocks.service';
import { loadPublicProfileMap } from '../common/utils/public-profile.util';
import { RateLimitService } from '../common/services/rate-limit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.module';
import { VerificationService } from '../verification/verification.service';
import { PresencePingInput, SetAvailableInput } from '@pingme/shared';

const GEO_AVAILABLE_KEY = 'geo:available';

@Injectable()
export class PresenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly rateLimit: RateLimitService,
    private readonly blocks: BlocksService,
    private readonly verification: VerificationService,
  ) {}

  async ping(userId: string, dto: PresencePingInput) {
    const allowed = await this.rateLimit.incrementWithinWindow(
      `rate:ping:${userId}`,
      LOCATION_PINGS_PER_HOUR,
      3600,
    );
    if (!allowed) {
      throw new HttpException('Location ping rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    const fuzzyLat = fuzzyCoordinate(dto.latitude);
    const fuzzyLng = fuzzyCoordinate(dto.longitude);

    const session = await this.prisma.presenceSession.upsert({
      where: { userId },
      update: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        fuzzyLat,
        fuzzyLng,
        locationAccuracy: dto.accuracy,
        locationUpdatedAt: new Date(),
      },
      create: {
        userId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        fuzzyLat,
        fuzzyLng,
        locationAccuracy: dto.accuracy,
        locationUpdatedAt: new Date(),
      },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.isAvailable) {
      await this.prisma.presenceSession.update({
        where: { userId },
        data: { isActive: true, endedAt: null },
      });
      await this.redis.client.geoadd(GEO_AVAILABLE_KEY, dto.longitude, dto.latitude, userId);
      await this.redis.client.set(
        `presence:${userId}`,
        JSON.stringify({ lat: fuzzyLat, lng: fuzzyLng, at: Date.now() }),
        'EX',
        PRESENCE_TTL_SECONDS,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });

    return {
      success: true,
      data: {
        sessionId: session.id,
        fuzzyLat,
        fuzzyLng,
        updatedAt: session.locationUpdatedAt,
      },
    };
  }

  async setAvailable(userId: string, dto: SetAvailableInput) {
    if (dto.isAvailable) {
      const passed = await this.verification.hasPassedLiveness(userId);
      if (!passed) {
        throw new ForbiddenException({
          code: 'LIVENESS_REQUIRED',
          message: 'Complete liveness verification to use this feature',
        });
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isAvailable: dto.isAvailable },
    });

    const session = await this.prisma.presenceSession.findUnique({ where: { userId } });

    if (dto.isAvailable) {
      await this.prisma.presenceSession.upsert({
        where: { userId },
        update: {
          isActive: true,
          startedAt: new Date(),
          endedAt: null,
        },
        create: {
          userId,
          isActive: true,
        },
      });

      if (session?.latitude != null && session.longitude != null) {
        await this.redis.client.geoadd(
          GEO_AVAILABLE_KEY,
          session.longitude,
          session.latitude,
          userId,
        );
        await this.redis.client.set(
          `presence:${userId}`,
          JSON.stringify({
            lat: session.fuzzyLat,
            lng: session.fuzzyLng,
            at: Date.now(),
          }),
          'EX',
          PRESENCE_TTL_SECONDS,
        );
      }
    } else {
      await this.prisma.presenceSession.updateMany({
        where: { userId },
        data: {
          isActive: false,
          endedAt: new Date(),
        },
      });
      await this.redis.client.zrem(GEO_AVAILABLE_KEY, userId);
      await this.redis.client.del(`presence:${userId}`);
    }

    return {
      success: true,
      data: { isAvailable: dto.isAvailable },
    };
  }

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { presenceSession: true },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      success: true,
      data: {
        isAvailable: user.isAvailable,
        lastPingAt: user.presenceSession?.locationUpdatedAt ?? null,
        fuzzyLat: user.presenceSession?.fuzzyLat ?? null,
        fuzzyLng: user.presenceSession?.fuzzyLng ?? null,
      },
    };
  }

  async getNearbyCount(userId: string) {
    const session = await this.prisma.presenceSession.findUnique({ where: { userId } });
    if (!session?.latitude || !session?.longitude) {
      throw new BadRequestException('Location required — send a ping first');
    }

    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    const radius =
      settings?.radiusMeters ??
      Number(this.config.get('DEFAULT_RADIUS_METERS', 250));

    const blockedIds = await this.blocks.getBlockedUserIds(userId);
    const redisCount = await this.redis.client.zcard(GEO_AVAILABLE_KEY);

    if (redisCount > 0) {
      const members = (await this.redis.client.georadius(
        GEO_AVAILABLE_KEY,
        session.longitude,
        session.latitude,
        radius,
        'm',
        'WITHDIST',
      )) as [string, string][];

      const count = members.filter(
        ([memberId]) => memberId !== userId && !blockedIds.includes(memberId),
      ).length;

      return { success: true, data: { count, radiusMeters: radius, source: 'redis' as const } };
    }

    const blockedFilter =
      blockedIds.length > 0
        ? Prisma.sql`AND ps.user_id NOT IN (${Prisma.join(blockedIds)})`
        : Prisma.empty;

    const rows = await this.prisma.$queryRaw<{ user_id: string }[]>`
      SELECT ps.user_id
      FROM presence_sessions ps
      INNER JOIN users u ON u.id = ps.user_id
      WHERE u.is_available = true
        AND ps.is_active = true
        AND ps.latitude IS NOT NULL
        AND ps.longitude IS NOT NULL
        AND ps.user_id != ${userId}
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(ps.longitude, ps.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${session.longitude}, ${session.latitude}), 4326)::geography,
          ${radius}
        )
        ${blockedFilter}
    `;

    return {
      success: true,
      data: { count: rows.length, radiusMeters: radius, source: 'postgis' as const },
    };
  }

  async getNearbyUsers(userId: string) {
    const session = await this.prisma.presenceSession.findUnique({ where: { userId } });
    if (!session?.latitude || !session?.longitude) {
      throw new BadRequestException('Location required — send a ping first');
    }

    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    const radius =
      settings?.radiusMeters ??
      Number(this.config.get('DEFAULT_RADIUS_METERS', 250));

    const blockedIds = await this.blocks.getBlockedUserIds(userId);
    const blockedSet = new Set(blockedIds);

    const rows = await this.prisma.$queryRaw<
      { user_id: string; distance_meters: number }[]
    >`
      SELECT
        ps.user_id,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(ps.longitude, ps.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${session.longitude}, ${session.latitude}), 4326)::geography
        ) AS distance_meters
      FROM presence_sessions ps
      INNER JOIN users u ON u.id = ps.user_id
      WHERE u.is_available = true
        AND ps.is_active = true
        AND ps.latitude IS NOT NULL
        AND ps.longitude IS NOT NULL
        AND ps.user_id != ${userId}::uuid
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(ps.longitude, ps.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${session.longitude}, ${session.latitude}), 4326)::geography,
          ${radius}
        )
      ORDER BY distance_meters ASC
    `;

    const userIds = rows.map((row) => row.user_id).filter((id) => !blockedSet.has(id));
    const profiles = userIds.length
      ? await this.prisma.profile.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, displayName: true, avatarUrl: true },
        })
      : [];
    const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
    const flairByUserId = await loadPublicProfileMap(this.prisma, userIds);

    const data = rows
      .filter((row) => !blockedSet.has(row.user_id))
      .map((row) => {
        const profile = profileByUserId.get(row.user_id);
        const flair = flairByUserId.get(row.user_id) ?? { isPremium: false, avatarTheme: null };
        return {
          userId: row.user_id,
          displayName: profile?.displayName ?? 'Someone nearby',
          avatarUrl: profile?.avatarUrl ?? null,
          distanceBucket: distanceBucket(Number(row.distance_meters)),
          isPremium: flair.isPremium,
          avatarTheme: flair.avatarTheme,
        };
      });

    return { success: true, data: { users: data, radiusMeters: radius } };
  }

  getDistanceBucket(meters: number) {
    return distanceBucket(meters);
  }
}
