import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      dau,
      postsToday,
      openReports,
      reviewingReports,
      totalUsers,
      suspendedUsers,
      activePresence,
      recentReports,
    ] = await Promise.all([
      this.prisma.user.count({
        where: {
          deletedAt: null,
          OR: [
            { lastSeenAt: { gte: since24h } },
            { createdAt: { gte: since24h } },
          ],
        },
      }),
      this.prisma.wallPost.count({
        where: { createdAt: { gte: startOfDay } },
      }),
      this.prisma.report.count({ where: { status: 'open' } }),
      this.prisma.report.count({ where: { status: 'reviewing' } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'suspended', deletedAt: null } }),
      this.prisma.presenceSession.count({ where: { isActive: true } }),
      this.prisma.report.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          reportedUser: { include: { profile: { select: { displayName: true } } } },
        },
      }),
    ]);

    return {
      dau,
      postsToday,
      openReports,
      reviewingReports,
      totalUsers,
      suspendedUsers,
      activePresence,
      recentReports: recentReports.map((r) => ({
        id: r.id,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt,
        reportedUserDisplayName: r.reportedUser.profile?.displayName ?? null,
      })),
      flaggedUsers: await this.getFlaggedUsers(),
    };
  }

  private async getFlaggedUsers() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const grouped = await this.prisma.report.groupBy({
      by: ['reportedUserId'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      having: { id: { _count: { gte: 3 } } },
    });

    if (!grouped.length) return [];

    const userIds = grouped.map((g) => g.reportedUserId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      include: { profile: { select: { displayName: true } } },
    });

    return grouped.map((g) => {
      const user = users.find((u) => u.id === g.reportedUserId);
      return {
        userId: g.reportedUserId,
        reportCount: g._count.id,
        displayName: user?.profile?.displayName ?? null,
        status: user?.status ?? null,
      };
    });
  }
}
