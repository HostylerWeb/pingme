import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IcebreakerSessionStatus } from '@pingme/db';
import {
  ICEBREAKER_RADIUS_METERS,
  ICEBREAKER_STARTS_PER_HOUR,
  ICEBREAKER_WINDOW_MINUTES,
  NOTIFICATION_TYPES,
} from '@pingme/shared';
import { AuditService } from '../audit/audit.service';
import { BlocksService } from '../common/services/blocks.service';
import { RateLimitService } from '../common/services/rate-limit.service';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';

interface SessionPairRow {
  session_a_id: string;
  user_a_id: string;
  session_b_id: string;
  user_b_id: string;
  distance_meters: number;
}

@Injectable()
export class IcebreakerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly blocks: BlocksService,
    private readonly rateLimit: RateLimitService,
    private readonly notifications: NotificationService,
  ) {}

  async start(userId: string) {
    const allowed = await this.rateLimit.incrementWithinWindow(
      `rate:icebreaker:${userId}`,
      ICEBREAKER_STARTS_PER_HOUR,
      3600,
    );
    if (!allowed) {
      throw new BadRequestException('Icebreaker limit reached — try again later');
    }

    const session = await this.prisma.presenceSession.findUnique({ where: { userId } });
    if (!session?.latitude || !session?.longitude) {
      throw new BadRequestException('Location required — send a ping first');
    }

    const existing = await this.prisma.icebreakerSession.findFirst({
      where: { userId, status: IcebreakerSessionStatus.active },
    });
    if (existing) {
      await this.prisma.icebreakerSession.update({
        where: { id: existing.id },
        data: { status: IcebreakerSessionStatus.cancelled },
      });
    }

    const windowMinutes = Number(
      this.config.get('ICEBREAKER_WINDOW_MINUTES', ICEBREAKER_WINDOW_MINUTES),
    );
    const expiresAt = new Date(Date.now() + windowMinutes * 60 * 1000);

    const icebreaker = await this.prisma.icebreakerSession.create({
      data: {
        userId,
        latitude: session.latitude,
        longitude: session.longitude,
        expiresAt,
      },
    });

    await this.audit.log({
      userId,
      action: 'icebreaker.start',
      entityType: 'icebreaker_session',
      entityId: icebreaker.id,
    });

    return {
      success: true,
      data: {
        id: icebreaker.id,
        status: icebreaker.status,
        expiresAt: icebreaker.expiresAt,
      },
    };
  }

  async cancel(userId: string) {
    const active = await this.prisma.icebreakerSession.findFirst({
      where: { userId, status: IcebreakerSessionStatus.active },
    });
    if (!active) {
      throw new NotFoundException('No active icebreaker session');
    }

    await this.prisma.icebreakerSession.update({
      where: { id: active.id },
      data: { status: IcebreakerSessionStatus.cancelled },
    });

    return { success: true };
  }

  async getStatus(userId: string) {
    const active = await this.prisma.icebreakerSession.findFirst({
      where: {
        userId,
        status: { in: [IcebreakerSessionStatus.active, IcebreakerSessionStatus.matched] },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (active?.status === IcebreakerSessionStatus.active) {
      const presence = await this.prisma.presenceSession.findUnique({ where: { userId } });
      if (presence?.latitude != null && presence?.longitude != null) {
        await this.prisma.icebreakerSession.update({
          where: { id: active.id },
          data: {
            latitude: presence.latitude,
            longitude: presence.longitude,
          },
        });
        active.latitude = presence.latitude;
        active.longitude = presence.longitude;
      }
    }

    return {
      success: true,
      data: active
        ? {
            id: active.id,
            status: active.status,
            expiresAt: active.expiresAt,
            matchedSessionId: active.matchedSessionId,
          }
        : null,
    };
  }

  async expireSessions() {
    const now = new Date();
    const result = await this.prisma.icebreakerSession.updateMany({
      where: {
        status: IcebreakerSessionStatus.active,
        expiresAt: { lt: now },
      },
      data: { status: IcebreakerSessionStatus.expired },
    });
    return result.count;
  }

  async findAndCreateMatches() {
    const radius = Number(this.config.get('ICEBREAKER_RADIUS_METERS', ICEBREAKER_RADIUS_METERS));
    const now = new Date();

    const pairs = await this.prisma.$queryRaw<SessionPairRow[]>`
      SELECT
        a.id AS session_a_id,
        a.user_id AS user_a_id,
        b.id AS session_b_id,
        b.user_id AS user_b_id,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(a.longitude, a.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography
        ) AS distance_meters
      FROM icebreaker_sessions a
      INNER JOIN icebreaker_sessions b ON a.user_id < b.user_id
      WHERE a.status = 'active'
        AND b.status = 'active'
        AND a.expires_at > ${now}
        AND b.expires_at > ${now}
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(a.longitude, a.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
          ${radius}
        )
      ORDER BY distance_meters ASC
    `;

    let created = 0;

    for (const pair of pairs) {
      const blocked = await this.blocks.getBlockedUserIds(pair.user_a_id);
      if (blocked.includes(pair.user_b_id)) continue;

      const [userAId, userBId] = orderUserIds(pair.user_a_id, pair.user_b_id);

      const existingPending = await this.prisma.match.findFirst({
        where: {
          userAId,
          userBId,
          status: 'pending',
        },
      });
      if (existingPending) continue;

      const match = await this.prisma.$transaction(async (tx) => {
        const sessionA = await tx.icebreakerSession.findUnique({
          where: { id: pair.session_a_id },
        });
        const sessionB = await tx.icebreakerSession.findUnique({
          where: { id: pair.session_b_id },
        });
        if (
          !sessionA ||
          !sessionB ||
          sessionA.status !== IcebreakerSessionStatus.active ||
          sessionB.status !== IcebreakerSessionStatus.active
        ) {
          return null;
        }

        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        const createdMatch = await tx.match.create({
          data: {
            userAId,
            userBId,
            source: 'icebreaker',
            sourceReferenceId: sessionA.id,
            expiresAt,
          },
        });

        await tx.icebreakerSession.update({
          where: { id: sessionA.id },
          data: {
            status: IcebreakerSessionStatus.matched,
            matchedSessionId: sessionB.id,
          },
        });
        await tx.icebreakerSession.update({
          where: { id: sessionB.id },
          data: {
            status: IcebreakerSessionStatus.matched,
            matchedSessionId: sessionA.id,
          },
        });

        return createdMatch;
      });

      if (!match) continue;

      created += 1;

      await this.audit.log({
        userId: pair.user_a_id,
        action: 'icebreaker.match',
        entityType: 'match',
        entityId: match.id,
        metadata: { otherUserId: pair.user_b_id },
      });

      await this.notifications.sendToUser(pair.user_a_id, {
        type: NOTIFICATION_TYPES.ICEBREAKER_MATCH,
        title: 'Someone nearby wants to connect',
        body: 'Open PingMe to accept or decline.',
        data: { type: NOTIFICATION_TYPES.ICEBREAKER_MATCH, matchId: match.id },
      });
      await this.notifications.sendToUser(pair.user_b_id, {
        type: NOTIFICATION_TYPES.ICEBREAKER_MATCH,
        title: 'Someone nearby wants to connect',
        body: 'Open PingMe to accept or decline.',
        data: { type: NOTIFICATION_TYPES.ICEBREAKER_MATCH, matchId: match.id },
      });
    }

    return created;
  }
}

function orderUserIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
