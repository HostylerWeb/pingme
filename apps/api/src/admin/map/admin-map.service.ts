import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
        userId: true,
        locationUpdatedAt: true,
        user: {
          select: {
            isAvailable: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    });

    const cellSize = 0.005;
    const cells = new Map<string, { lat: number; lng: number; count: number }>();

    for (const session of sessions) {
      if (session.fuzzyLat == null || session.fuzzyLng == null) continue;
      const cellLat = Math.round(session.fuzzyLat / cellSize) * cellSize;
      const cellLng = Math.round(session.fuzzyLng / cellSize) * cellSize;
      const key = `${cellLat},${cellLng}`;
      const existing = cells.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        cells.set(key, { lat: cellLat, lng: cellLng, count: 1 });
      }
    }

    return {
      totalActive: sessions.length,
      availableCount: sessions.filter((s) => s.user.isAvailable).length,
      cells: Array.from(cells.values()).sort((a, b) => b.count - a.count),
      points: sessions.map((s) => ({
        lat: s.fuzzyLat,
        lng: s.fuzzyLng,
        isAvailable: s.user.isAvailable,
        displayName: s.user.profile?.displayName ?? null,
        updatedAt: s.locationUpdatedAt,
      })),
    };
  }
}
