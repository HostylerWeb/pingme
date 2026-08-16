import { Injectable } from '@nestjs/common';
import { IcebreakerSessionStatus, UserStatus } from '@pingme/db';
import { fuzzyCoordinate } from '@pingme/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.module';
import {
  ADMIN_MAP_CACHE_KEY,
  ADMIN_MAP_CACHE_TTL_SECONDS,
  ADMIN_MAP_WATCHING_KEY,
  ADMIN_MAP_WATCHING_TTL_SECONDS,
  CLUSTER_CELL_SIZE_DEGREES,
  CLUSTER_RADIUS_METERS,
  type AdminHeatmapCell,
  type AdminHeatmapResponse,
} from './admin-map.constants';

type OnlineUser = {
  lat: number;
  lng: number;
  onWall: boolean;
  onIcebreaker: boolean;
};

@Injectable()
export class AdminMapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Read-only when cached; cold-bootstrap once when the map page opens with an empty cache. */
  async getHeatmap(): Promise<AdminHeatmapResponse> {
    await this.touchWatching();

    const cached = await this.redis.client.get(ADMIN_MAP_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as AdminHeatmapResponse;
    }

    return this.refreshHeatmapCache();
  }

  /** Extend the "someone is viewing the map" heartbeat (called on each poll). */
  async touchWatching(): Promise<void> {
    await this.redis.client.set(
      ADMIN_MAP_WATCHING_KEY,
      '1',
      'EX',
      ADMIN_MAP_WATCHING_TTL_SECONDS,
    );
  }

  async stopWatching(): Promise<void> {
    await this.redis.client.del(ADMIN_MAP_WATCHING_KEY);
  }

  async isMapBeingWatched(): Promise<boolean> {
    return (await this.redis.client.exists(ADMIN_MAP_WATCHING_KEY)) === 1;
  }

  /** Worker-only: rebuild heatmap from Postgres and write to Redis. */
  async refreshHeatmapCache(): Promise<AdminHeatmapResponse> {
    const fresh = await this.computeHeatmap();
    fresh.ready = true;
    await this.redis.client.set(
      ADMIN_MAP_CACHE_KEY,
      JSON.stringify(fresh),
      'EX',
      ADMIN_MAP_CACHE_TTL_SECONDS,
    );
    return fresh;
  }

  private async computeHeatmap(): Promise<AdminHeatmapResponse> {
    const now = new Date();
    const onlineUsers = new Map<string, OnlineUser>();

    const [wallSessions, icebreakerSessions] = await Promise.all([
      this.prisma.presenceSession.findMany({
        where: {
          isActive: true,
          fuzzyLat: { not: null },
          fuzzyLng: { not: null },
          user: {
            isAvailable: true,
            deletedAt: null,
            status: UserStatus.active,
          },
        },
        select: {
          userId: true,
          fuzzyLat: true,
          fuzzyLng: true,
        },
      }),
      this.prisma.icebreakerSession.findMany({
        where: {
          status: IcebreakerSessionStatus.active,
          expiresAt: { gt: now },
          user: {
            deletedAt: null,
            status: UserStatus.active,
          },
        },
        select: {
          userId: true,
          latitude: true,
          longitude: true,
        },
      }),
    ]);

    for (const session of wallSessions) {
      if (session.fuzzyLat == null || session.fuzzyLng == null) continue;
      onlineUsers.set(session.userId, {
        lat: session.fuzzyLat,
        lng: session.fuzzyLng,
        onWall: true,
        onIcebreaker: false,
      });
    }

    const iceOnlyUserIds = icebreakerSessions
      .map((session) => session.userId)
      .filter((userId) => !onlineUsers.has(userId));

    const presenceForIceOnly = iceOnlyUserIds.length
      ? await this.prisma.presenceSession.findMany({
          where: {
            userId: { in: iceOnlyUserIds },
            fuzzyLat: { not: null },
            fuzzyLng: { not: null },
          },
          select: {
            userId: true,
            fuzzyLat: true,
            fuzzyLng: true,
          },
        })
      : [];

    const presenceByUserId = new Map(
      presenceForIceOnly.map((session) => [session.userId, session]),
    );

    for (const session of icebreakerSessions) {
      const existing = onlineUsers.get(session.userId);
      if (existing) {
        existing.onIcebreaker = true;
        continue;
      }

      const presence = presenceByUserId.get(session.userId);
      const lat =
        presence?.fuzzyLat != null ? presence.fuzzyLat : fuzzyCoordinate(session.latitude);
      const lng =
        presence?.fuzzyLng != null ? presence.fuzzyLng : fuzzyCoordinate(session.longitude);

      onlineUsers.set(session.userId, {
        lat,
        lng,
        onWall: false,
        onIcebreaker: true,
      });
    }

    const cells = new Map<string, AdminHeatmapCell>();
    let wallCount = 0;
    let icebreakerCount = 0;

    for (const user of onlineUsers.values()) {
      if (user.onWall) wallCount += 1;
      if (user.onIcebreaker) icebreakerCount += 1;

      const cellLat = Math.round(user.lat / CLUSTER_CELL_SIZE_DEGREES) * CLUSTER_CELL_SIZE_DEGREES;
      const cellLng = Math.round(user.lng / CLUSTER_CELL_SIZE_DEGREES) * CLUSTER_CELL_SIZE_DEGREES;
      const key = `${cellLat},${cellLng}`;
      const existing = cells.get(key);
      if (existing) {
        existing.count += 1;
        if (user.onWall) existing.wallCount += 1;
        if (user.onIcebreaker) existing.icebreakerCount += 1;
      } else {
        cells.set(key, {
          lat: cellLat,
          lng: cellLng,
          count: 1,
          wallCount: user.onWall ? 1 : 0,
          icebreakerCount: user.onIcebreaker ? 1 : 0,
        });
      }
    }

    return {
      totalActive: onlineUsers.size,
      wallCount,
      icebreakerCount,
      clusterRadiusMeters: CLUSTER_RADIUS_METERS,
      cells: Array.from(cells.values()).sort((a, b) => b.count - a.count),
      cachedAt: new Date().toISOString(),
      ready: true,
    };
  }
}
