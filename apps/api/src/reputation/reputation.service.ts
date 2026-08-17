import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ReputationEventSourceType } from '@pingme/db';
import {
  REPUTATION_DAILY_ACTIVITY_CAP,
  REPUTATION_DAILY_ACTIVITY_SOURCES,
  REPUTATION_DAILY_SOURCE_CAPS,
  REPUTATION_EARN_ONE_TIME,
  REPUTATION_EARN_RECURRING,
  ReputationEventSourceType as SharedReputationSourceType,
  buildReputationSummary,
  clampReputationScore,
  getReputationTier,
} from '@pingme/shared';
import { PrismaService } from '../prisma/prisma.service';

type ApplyDeltaInput = {
  userId: string;
  delta: number;
  sourceType: ReputationEventSourceType;
  sourceId: string;
  adminId?: string | null;
  note?: string | null;
  skipDailyCaps?: boolean;
};

function deterministicUuid(seed: string): string {
  const hash = createHash('sha256').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);

  constructor(private readonly prisma: PrismaService) {}

  getSummaryForScore(score: number) {
    return buildReputationSummary(score);
  }

  async getUserSummary(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { reputationScore: true },
    });
    return buildReputationSummary(user?.reputationScore ?? 0);
  }

  async getMeReputation(userId: string) {
    await this.syncPassiveRewards(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { reputationScore: true },
    });
    const summary = buildReputationSummary(user?.reputationScore ?? 0);
    const recentEvents = await this.prisma.reputationEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        delta: true,
        balanceAfter: true,
        sourceType: true,
        note: true,
        createdAt: true,
      },
    });
    return { ...summary, recentEvents };
  }

  async listEvents(userId: string, limit = 50) {
    return this.prisma.reputationEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
    });
  }

  async grantOnce(
    userId: string,
    sourceType: SharedReputationSourceType,
    sourceId = userId,
  ) {
    const points = REPUTATION_EARN_ONE_TIME[sourceType];
    if (!points) {
      return { applied: false as const };
    }
    return this.applyDelta({
      userId,
      delta: points,
      sourceType: sourceType as ReputationEventSourceType,
      sourceId,
      skipDailyCaps: true,
    });
  }

  async grantActivity(
    userId: string,
    sourceType: Extract<
      SharedReputationSourceType,
      'activity_wall' | 'activity_icebreaker_match' | 'activity_event_host' | 'activity_event_attend'
    >,
    sourceId: string,
  ) {
    const points = REPUTATION_EARN_RECURRING[sourceType];
    if (!points) {
      return { applied: false as const };
    }
    return this.applyDelta({
      userId,
      delta: points,
      sourceType: sourceType as ReputationEventSourceType,
      sourceId,
    });
  }

  async grantFirstWallPost(userId: string, postId: string) {
    const existingPosts = await this.prisma.wallPost.count({
      where: { userId, status: 'active' },
    });
    if (existingPosts > 1) {
      return { applied: false as const };
    }
    return this.grantOnce(userId, 'activity_first_wall_post', postId);
  }

  async grantMutualMatch(userId: string, matchId: string) {
    return this.grantActivity(userId, 'activity_icebreaker_match', matchId);
  }

  async applyAdminDeduction(input: {
    userId: string;
    amount: number;
    sourceType: 'report_deduction' | 'report_reporter_penalty' | 'admin_adjustment';
    sourceId: string;
    adminId: string;
    note?: string;
  }) {
    if (input.amount <= 0) {
      return { applied: false as const };
    }
    return this.applyDelta({
      userId: input.userId,
      delta: -input.amount,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      adminId: input.adminId,
      note: input.note,
      skipDailyCaps: true,
    });
  }

  async syncPassiveRewards(userId: string) {
    await Promise.all([this.grantAccountAgeWeeks(userId), this.grantWeeklyStreak(userId)]);
  }

  private async grantAccountAgeWeeks(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });
    if (!user) return;

    const points = REPUTATION_EARN_RECURRING.activity_account_age ?? 0;
    if (points <= 0) return;

    const now = new Date();
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksElapsed = Math.min(
      104,
      Math.floor((now.getTime() - user.createdAt.getTime()) / msPerWeek),
    );

    for (let week = 0; week < weeksElapsed; week += 1) {
      const weekStart = new Date(user.createdAt.getTime() + week * msPerWeek);
      const sourceId = deterministicUuid(`reputation:account-age:${userId}:${weekStart.toISOString().slice(0, 10)}`);
      await this.applyDelta({
        userId,
        delta: points,
        sourceType: ReputationEventSourceType.activity_account_age,
        sourceId,
        skipDailyCaps: true,
      });
    }
  }

  private async grantWeeklyStreak(userId: string) {
    const points = REPUTATION_EARN_RECURRING.activity_weekly_streak ?? 0;
    if (points <= 0) return;

    const weekStart = this.startOfUtcWeek(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const activityDays = await this.prisma.reputationEvent.findMany({
      where: {
        userId,
        sourceType: {
          in: [
            ReputationEventSourceType.activity_wall,
            ReputationEventSourceType.activity_icebreaker_match,
          ],
        },
        createdAt: { gte: weekStart, lt: weekEnd },
      },
      select: { createdAt: true },
    });

    const uniqueDays = new Set(
      activityDays.map((event) => event.createdAt.toISOString().slice(0, 10)),
    );
    if (uniqueDays.size < 5) {
      return;
    }

    const sourceId = deterministicUuid(
      `reputation:weekly-streak:${userId}:${weekStart.toISOString().slice(0, 10)}`,
    );

    await this.applyDelta({
      userId,
      delta: points,
      sourceType: ReputationEventSourceType.activity_weekly_streak,
      sourceId,
      skipDailyCaps: true,
    });
  }

  private async applyDelta(input: ApplyDeltaInput) {
    if (input.delta === 0) {
      return { applied: false as const };
    }

    if (input.delta > 0 && !input.skipDailyCaps) {
      const allowed = await this.canEarnActivityPoints(
        input.userId,
        input.sourceType,
        input.delta,
      );
      if (!allowed) {
        return { applied: false as const };
      }
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.reputationEvent.findUnique({
          where: {
            userId_sourceType_sourceId: {
              userId: input.userId,
              sourceType: input.sourceType,
              sourceId: input.sourceId,
            },
          },
        });
        if (existing) {
          return null;
        }

        const user = await tx.user.findUnique({
          where: { id: input.userId },
          select: { reputationScore: true },
        });
        if (!user) {
          return null;
        }

        const nextScore = clampReputationScore(user.reputationScore + input.delta);
        const actualDelta = nextScore - user.reputationScore;
        if (actualDelta === 0) {
          return null;
        }

        await tx.user.update({
          where: { id: input.userId },
          data: { reputationScore: nextScore },
        });

        const event = await tx.reputationEvent.create({
          data: {
            userId: input.userId,
            delta: actualDelta,
            balanceAfter: nextScore,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            adminId: input.adminId ?? null,
            note: input.note ?? null,
          },
        });

        return { event, score: nextScore };
      });

      if (!result) {
        return { applied: false as const };
      }

      return {
        applied: true as const,
        score: result.score,
        tier: getReputationTier(result.score),
        eventId: result.event.id,
      };
    } catch (error) {
      this.logger.debug(`Reputation delta skipped for ${input.userId}: ${String(error)}`);
      return { applied: false as const };
    }
  }

  private async canEarnActivityPoints(
    userId: string,
    sourceType: ReputationEventSourceType,
    delta: number,
  ) {
    const dayStart = this.startOfUtcDay(new Date());
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const [sourceTotal, combinedTotal] = await Promise.all([
      this.sumPositiveDelta(userId, [sourceType], dayStart, dayEnd),
      REPUTATION_DAILY_ACTIVITY_SOURCES.includes(sourceType as SharedReputationSourceType)
        ? this.sumPositiveDelta(
            userId,
            REPUTATION_DAILY_ACTIVITY_SOURCES as ReputationEventSourceType[],
            dayStart,
            dayEnd,
          )
        : Promise.resolve(0),
    ]);

    const sourceCap = REPUTATION_DAILY_SOURCE_CAPS[sourceType as SharedReputationSourceType];
    if (sourceCap != null && sourceTotal + delta > sourceCap) {
      return false;
    }

    if (
      REPUTATION_DAILY_ACTIVITY_SOURCES.includes(sourceType as SharedReputationSourceType) &&
      combinedTotal + delta > REPUTATION_DAILY_ACTIVITY_CAP
    ) {
      return false;
    }

    return true;
  }

  private async sumPositiveDelta(
    userId: string,
    sourceTypes: ReputationEventSourceType[],
    from: Date,
    to: Date,
  ) {
    const aggregate = await this.prisma.reputationEvent.aggregate({
      where: {
        userId,
        sourceType: { in: sourceTypes },
        delta: { gt: 0 },
        createdAt: { gte: from, lt: to },
      },
      _sum: { delta: true },
    });
    return aggregate._sum.delta ?? 0;
  }

  private startOfUtcDay(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private startOfUtcWeek(date: Date) {
    const day = date.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() + diff);
    return this.startOfUtcDay(monday);
  }
}
