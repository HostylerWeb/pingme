import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** ~550 m grid cells — groups nearby users without exposing exact pins. */
const CLUSTER_CELL_SIZE_DEGREES = 0.005;
const CLUSTER_RADIUS_METERS = 550;

@Injectable()
export class AdminMapService {
  constructor(private readonly prisma: PrismaService) {}

  async getHeatmap() {
    const sessions = await this.prisma.presenceSession.findMany({
      where: {
        isActive: true,
        fuzzyLat: { not: null },
        fuzzyLng: { not: null },
      },
      select: {
        fuzzyLat: true,
        fuzzyLng: true,
        user: {
          select: {
            isAvailable: true,
          },
        },
      },
    });

    const cells = new Map<
      string,
      { lat: number; lng: number; count: number; availableCount: number }
    >();

    for (const session of sessions) {
      if (session.fuzzyLat == null || session.fuzzyLng == null) continue;
      const cellLat = Math.round(session.fuzzyLat / CLUSTER_CELL_SIZE_DEGREES) * CLUSTER_CELL_SIZE_DEGREES;
      const cellLng = Math.round(session.fuzzyLng / CLUSTER_CELL_SIZE_DEGREES) * CLUSTER_CELL_SIZE_DEGREES;
      const key = `${cellLat},${cellLng}`;
      const existing = cells.get(key);
      if (existing) {
        existing.count += 1;
        if (session.user.isAvailable) existing.availableCount += 1;
      } else {
        cells.set(key, {
          lat: cellLat,
          lng: cellLng,
          count: 1,
          availableCount: session.user.isAvailable ? 1 : 0,
        });
      }
    }

    return {
      totalActive: sessions.length,
      availableCount: sessions.filter((s) => s.user.isAvailable).length,
      clusterRadiusMeters: CLUSTER_RADIUS_METERS,
      cells: Array.from(cells.values()).sort((a, b) => b.count - a.count),
    };
  }
}
