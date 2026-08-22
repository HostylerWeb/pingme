import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { IcebreakerSessionStatus, MatchStatus } from '@pingme/db';
import {
  MATCH_EXPIRY_MINUTES,
  NOTIFICATION_TYPES,
  distanceBucket,
  isUserActiveNow,
} from '@pingme/shared';
import { IcebreakerNearbyPushService } from './icebreaker-nearby-push.service';
import { AuditService } from '../audit/audit.service';
import { AppConfigService } from '../config/app-config.service';
import { ChatGateway } from '../chat/chat.gateway';
import { BlocksService } from '../common/services/blocks.service';
import { loadPublicProfileMap } from '../common/utils/public-profile.util';
import { RateLimitService } from '../common/services/rate-limit.service';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { isPrismaUniqueConflict } from '../common/utils/prisma-error.util';
import { StartIcebreakerDto } from './dto/icebreaker.dto';

interface NearbySessionRow {
  session_id: string;
  user_id: string;
  show_photo: boolean;
  intro_message: string | null;
  distance_meters: number;
}

@Injectable()
export class IcebreakerService {
  private readonly logger = new Logger(IcebreakerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
    private readonly audit: AuditService,
    private readonly blocks: BlocksService,
    private readonly rateLimit: RateLimitService,
    private readonly notifications: NotificationService,
    private readonly nearbyPush: IcebreakerNearbyPushService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly gateway: ChatGateway,
  ) {}

  async start(userId: string, options: StartIcebreakerDto = {}) {
    const icebreakerConfig = this.appConfig.getIcebreakerConfig();
    const allowed = await this.rateLimit.incrementWithinWindow(
      `rate:icebreaker:${userId}`,
      icebreakerConfig.startsPerHour,
      3600,
    );
    if (!allowed) {
      throw new BadRequestException('Icebreaker limit reached — try again later');
    }

    const session = await this.prisma.presenceSession.findUnique({ where: { userId } });
    if (!session?.latitude || !session?.longitude) {
      throw new BadRequestException('Location required — send a ping first');
    }

    const latitude = session.latitude;
    const longitude = session.longitude;
    const windowMinutes = icebreakerConfig.windowMinutes;
    const expiresAt = new Date(Date.now() + windowMinutes * 60 * 1000);
    const introMessage = options.introMessage?.trim() || null;

    const createActiveSession = () =>
      this.prisma.$transaction(async (tx) => {
        await tx.icebreakerSession.updateMany({
          where: { userId, status: IcebreakerSessionStatus.active },
          data: { status: IcebreakerSessionStatus.cancelled },
        });
        return tx.icebreakerSession.create({
          data: {
            userId,
            latitude,
            longitude,
            showPhoto: options.showPhoto ?? false,
            introMessage,
            expiresAt,
          },
        });
      });

    let icebreaker;
    try {
      icebreaker = await createActiveSession();
    } catch (error) {
      if (!isPrismaUniqueConflict(error)) {
        throw error;
      }
      icebreaker = await createActiveSession();
    }

    await this.audit.log({
      userId,
      action: 'icebreaker.start',
      entityType: 'icebreaker_session',
      entityId: icebreaker.id,
    });

    void this.nearbyPush
      .notifyNearbyUsersOnStart(userId, icebreaker.id, session.latitude, session.longitude)
      .catch((error) => {
      this.logger.error(
        `Failed to send icebreaker proximity pushes for session ${icebreaker.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    });

    return {
      success: true,
      data: {
        id: icebreaker.id,
        status: icebreaker.status,
        expiresAt: icebreaker.expiresAt,
        showPhoto: icebreaker.showPhoto,
        introMessage: icebreaker.introMessage,
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
    await this.expireInterests();

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

    const unansweredRows = await this.prisma.icebreakerInterest.findMany({
      where: {
        fromUserId: userId,
        expiredAt: { not: null },
        unansweredAcknowledgedAt: null,
      },
      orderBy: { expiredAt: 'desc' },
      take: 10,
    });

    const unansweredProfiles = unansweredRows.length
      ? await this.prisma.profile.findMany({
          where: { userId: { in: unansweredRows.map((row) => row.toUserId) } },
          select: { userId: true, displayName: true },
        })
      : [];
    const profileByUserId = new Map(unansweredProfiles.map((profile) => [profile.userId, profile]));

    return {
      success: true,
      data: {
        session: active
          ? {
              id: active.id,
              status: active.status,
              expiresAt: active.expiresAt,
              matchedSessionId: active.matchedSessionId,
              showPhoto: active.showPhoto,
              introMessage: active.introMessage,
            }
          : null,
        unanswered: unansweredRows.map((row) => ({
          interestId: row.id,
          targetUserId: row.toUserId,
          displayName: profileByUserId.get(row.toUserId)?.displayName ?? 'Someone nearby',
          expiredAt: row.expiredAt!,
        })),
      },
    };
  }

  async acknowledgeUnanswered(userId: string, interestIds: string[]) {
    if (interestIds.length === 0) {
      return { success: true };
    }

    await this.prisma.icebreakerInterest.updateMany({
      where: {
        id: { in: interestIds },
        fromUserId: userId,
        expiredAt: { not: null },
        unansweredAcknowledgedAt: null,
      },
      data: { unansweredAcknowledgedAt: new Date() },
    });

    return { success: true };
  }

  async getNearby(userId: string) {
    const now = new Date();
    await this.expireInterests(now);
    const presence = await this.prisma.presenceSession.findUnique({ where: { userId } });

    const mySession = await this.prisma.icebreakerSession.findFirst({
      where: {
        userId,
        status: { in: [IcebreakerSessionStatus.active, IcebreakerSessionStatus.matched] },
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pendingMatches = await this.prisma.match.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        source: 'icebreaker',
        status: MatchStatus.pending,
      },
    });

    if (!mySession && pendingMatches.length === 0) {
      throw new BadRequestException('Start Break the ice to see nearby people');
    }

    const latitude = presence?.latitude ?? mySession?.latitude;
    const longitude = presence?.longitude ?? mySession?.longitude;
    if (latitude == null || longitude == null) {
      throw new BadRequestException('Location required — send a ping first');
    }

    if (mySession?.status === IcebreakerSessionStatus.active) {
      await this.prisma.icebreakerSession.update({
        where: { id: mySession.id },
        data: { latitude, longitude },
      });
    }

    const radius = this.appConfig.getDistanceConfig().icebreaker.radiusMeters;

    const rows = await this.prisma.$queryRaw<NearbySessionRow[]>`
      SELECT
        s.id AS session_id,
        s.user_id,
        s.show_photo,
        s.intro_message,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
          ST_SetSRID(
            ST_MakePoint(
              COALESCE(ps.longitude, s.longitude),
              COALESCE(ps.latitude, s.latitude)
            ),
            4326
          )::geography
        ) AS distance_meters
      FROM icebreaker_sessions s
      INNER JOIN users u ON u.id = s.user_id
        AND u.deleted_at IS NULL
        AND u.status <> 'deleted'
      LEFT JOIN presence_sessions ps ON ps.user_id = s.user_id
      WHERE s.user_id != ${userId}::uuid
        AND s.status = 'active'
        AND s.expires_at > ${now}
        AND COALESCE(ps.latitude, s.latitude) IS NOT NULL
        AND COALESCE(ps.longitude, s.longitude) IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
          ST_SetSRID(
            ST_MakePoint(
              COALESCE(ps.longitude, s.longitude),
              COALESCE(ps.latitude, s.latitude)
            ),
            4326
          )::geography,
          ${radius}
        )
      ORDER BY distance_meters ASC
      LIMIT 100
    `;

    const blocked = await this.blocks.getBlockedUserIds(userId);
    const blockedSet = new Set(blocked);

    const myInterests = await this.prisma.icebreakerInterest.findMany({
      where: { fromUserId: userId },
    });
    const interestByTarget = new Map(myInterests.map((row) => [row.toUserId, row]));

    const theirInterests = await this.prisma.icebreakerInterest.findMany({
      where: { toUserId: userId, interested: true },
    });
    const interestedInMe = new Set(
      theirInterests
        .filter((row) => isActiveYesInterest(row, now))
        .map((row) => row.fromUserId),
    );

    const pendingMatchByUserId = new Map(
      pendingMatches.map((match) => [
        match.userAId === userId ? match.userBId : match.userAId,
        match.id,
      ]),
    );

    const visibleRows = rows.filter(
      (row) =>
        !blockedSet.has(row.user_id) &&
        !isHiddenFromList(interestByTarget.get(row.user_id), now),
    );

    const profileIds = new Set(visibleRows.map((row) => row.user_id));
    for (const otherUserId of pendingMatchByUserId.keys()) {
      if (!blockedSet.has(otherUserId)) profileIds.add(otherUserId);
    }

    const profiles = profileIds.size
      ? await this.prisma.profile.findMany({
          where: { userId: { in: [...profileIds] } },
          select: { userId: true, displayName: true, avatarUrl: true },
        })
      : [];
    const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
    const flairByUserId = await loadPublicProfileMap(this.prisma, [...profileIds]);

    const userActivity = profileIds.size
      ? await this.prisma.user.findMany({
          where: { id: { in: [...profileIds] } },
          select: { id: true, lastSeenAt: true },
        })
      : [];
    const lastSeenByUserId = new Map(userActivity.map((user) => [user.id, user.lastSeenAt]));

    const withFlair = (userId: string) =>
      flairByUserId.get(userId) ?? {
        isPremium: false,
        avatarTheme: null,
        livenessVerified: false,
        gender: null,
        reputationTier: 'new' as const,
      };
    const withActiveNow = (userId: string) => isUserActiveNow(lastSeenByUserId.get(userId), now);

    const data = visibleRows.map((row) => {
      const profile = profileByUserId.get(row.user_id);
      const myInterest = interestByTarget.get(row.user_id);
      const myResponse = isActiveYesInterest(myInterest, now) ? 'yes' : null;
      const matchId = pendingMatchByUserId.get(row.user_id);
      const highlight = matchId
        ? ('mutual_match' as const)
        : interestedInMe.has(row.user_id) && !myResponse
          ? ('interested_in_you' as const)
          : null;

      return {
        userId: row.user_id,
        sessionId: row.session_id,
        displayName: profile?.displayName ?? 'Someone nearby',
        avatarUrl: row.show_photo ? profile?.avatarUrl ?? null : null,
        introMessage: row.intro_message,
        distanceBucket: distanceBucket(Number(row.distance_meters)),
        myResponse,
        interestedInMe: interestedInMe.has(row.user_id),
        highlight,
        matchId: matchId ?? null,
        isPremium: withFlair(row.user_id).isPremium,
        avatarTheme: withFlair(row.user_id).avatarTheme,
        livenessVerified: withFlair(row.user_id).livenessVerified,
        reputationTier: withFlair(row.user_id).reputationTier,
        gender: withFlair(row.user_id).gender,
        activeNow: withActiveNow(row.user_id),
      };
    });

    for (const [otherUserId, matchId] of pendingMatchByUserId) {
      if (blockedSet.has(otherUserId) || data.some((item) => item.userId === otherUserId)) {
        continue;
      }
      const profile = profileByUserId.get(otherUserId);
      const otherSession = await this.prisma.icebreakerSession.findFirst({
        where: { userId: otherUserId },
        orderBy: { createdAt: 'desc' },
      });
      data.unshift({
        userId: otherUserId,
        sessionId: otherSession?.id ?? otherUserId,
        displayName: profile?.displayName ?? 'Someone nearby',
        avatarUrl: otherSession?.showPhoto ? profile?.avatarUrl ?? null : null,
        introMessage: otherSession?.introMessage ?? null,
        distanceBucket: 'very_near',
        myResponse: 'yes',
        interestedInMe: true,
        highlight: 'mutual_match',
        matchId,
        isPremium: withFlair(otherUserId).isPremium,
        avatarTheme: withFlair(otherUserId).avatarTheme,
        livenessVerified: withFlair(otherUserId).livenessVerified,
        reputationTier: withFlair(otherUserId).reputationTier,
        gender: withFlair(otherUserId).gender,
        activeNow: withActiveNow(otherUserId),
      });
    }

    data.sort((a, b) => highlightPriority(a.highlight) - highlightPriority(b.highlight));

    return { success: true, data };
  }

  async setInterest(userId: string, targetUserId: string, interested: boolean) {
    if (userId === targetUserId) {
      throw new BadRequestException('Cannot respond to yourself');
    }

    const mySession = await this.prisma.icebreakerSession.findFirst({
      where: {
        userId,
        status: IcebreakerSessionStatus.active,
        expiresAt: { gt: new Date() },
      },
    });
    if (!mySession) {
      throw new BadRequestException('Start Break the ice first');
    }

    const targetSession = await this.prisma.icebreakerSession.findFirst({
      where: {
        userId: targetUserId,
        status: IcebreakerSessionStatus.active,
        expiresAt: { gt: new Date() },
      },
    });
    if (!targetSession) {
      throw new NotFoundException('That person is no longer in Break the ice');
    }

    if (
      mySession.latitude == null ||
      mySession.longitude == null ||
      targetSession.latitude == null ||
      targetSession.longitude == null
    ) {
      throw new BadRequestException('Location required — send a ping first');
    }

    const radius = this.appConfig.getDistanceConfig().icebreaker.radiusMeters;
    const [proximity] = await this.prisma.$queryRaw<{ nearby: boolean }[]>`
      SELECT ST_DWithin(
        ST_SetSRID(ST_MakePoint(${mySession.longitude}, ${mySession.latitude}), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${targetSession.longitude}, ${targetSession.latitude}), 4326)::geography,
        ${radius}
      ) AS nearby
    `;
    if (!proximity?.nearby) {
      throw new ForbiddenException('That person is no longer nearby');
    }

    const blocked = await this.blocks.getBlockedUserIds(userId);
    if (blocked.includes(targetUserId)) {
      throw new BadRequestException('Cannot connect with this user');
    }

    const icebreakerConfig = this.appConfig.getIcebreakerConfig();
    const hideMinutes = icebreakerConfig.hideMinutes;
    const interestExpiryMinutes = icebreakerConfig.interestExpiryMinutes;
    const hiddenUntil = interested
      ? null
      : new Date(Date.now() + hideMinutes * 60 * 1000);
    const expiresAt = interested
      ? new Date(Date.now() + interestExpiryMinutes * 60 * 1000)
      : null;

    await this.prisma.icebreakerInterest.upsert({
      where: {
        fromUserId_toUserId: { fromUserId: userId, toUserId: targetUserId },
      },
      create: {
        fromUserId: userId,
        toUserId: targetUserId,
        interested,
        hiddenUntil,
        expiresAt,
        expiredAt: null,
        unansweredAcknowledgedAt: null,
      },
      update: {
        interested,
        hiddenUntil,
        expiresAt,
        expiredAt: null,
        unansweredAcknowledgedAt: null,
      },
    });

    if (!interested) {
      return { success: true, data: { matched: false } };
    }

    const reverse = await this.prisma.icebreakerInterest.findUnique({
      where: {
        fromUserId_toUserId: { fromUserId: targetUserId, toUserId: userId },
      },
    });

    if (!isActiveYesInterest(reverse, new Date())) {
      const fromProfile = await this.prisma.profile.findUnique({
        where: { userId },
        select: { displayName: true },
      });
      const displayName = fromProfile?.displayName ?? 'Someone nearby';

      await this.notifications.sendToUser(targetUserId, {
        type: NOTIFICATION_TYPES.ICEBREAKER_INTEREST,
        title: 'Someone nearby said yes',
        body: `${displayName} wants to connect in Break the ice.`,
        data: {
          type: NOTIFICATION_TYPES.ICEBREAKER_INTEREST,
          fromUserId: userId,
        },
      });

      this.gateway.emitIcebreakerInterest(targetUserId, {
        fromUserId: userId,
        displayName,
      });

      return { success: true, data: { matched: false, waiting: true } };
    }

    const [userAId, userBId] = orderUserIds(userId, targetUserId);
    const existingMatch = await this.prisma.match.findFirst({
      where: {
        userAId,
        userBId,
        status: { in: [MatchStatus.pending, MatchStatus.active] },
      },
    });
    if (existingMatch) {
      return {
        success: true,
        data: { matched: true, matchId: existingMatch.id },
      };
    }

    let match;
    try {
      match = await this.prisma.$transaction(async (tx) => {
        const expiresAt = new Date(Date.now() + MATCH_EXPIRY_MINUTES * 60 * 1000);
        const createdMatch = await tx.match.create({
          data: {
            userAId,
            userBId,
            source: 'icebreaker',
            sourceReferenceId: mySession.id,
            expiresAt,
          },
        });

        await tx.icebreakerSession.update({
          where: { id: mySession.id },
          data: {
            status: IcebreakerSessionStatus.matched,
            matchedSessionId: targetSession.id,
          },
        });
        await tx.icebreakerSession.update({
          where: { id: targetSession.id },
          data: {
            status: IcebreakerSessionStatus.matched,
            matchedSessionId: mySession.id,
          },
        });

        await tx.icebreakerInterest.updateMany({
          where: {
            OR: [
              { fromUserId: userId, toUserId: targetUserId },
              { fromUserId: targetUserId, toUserId: userId },
            ],
          },
          data: { expiresAt: null, expiredAt: null },
        });

        return createdMatch;
      });
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        const raced = await this.prisma.match.findFirst({
          where: {
            userAId,
            userBId,
            status: { in: [MatchStatus.pending, MatchStatus.active] },
          },
        });
        if (raced) {
          return {
            success: true,
            data: { matched: true, matchId: raced.id },
          };
        }
      }
      throw error;
    }

    await this.audit.log({
      userId,
      action: 'icebreaker.match',
      entityType: 'match',
      entityId: match.id,
      metadata: { otherUserId: targetUserId },
    });

    await this.notifications.sendToUser(userId, {
      type: NOTIFICATION_TYPES.ICEBREAKER_MATCH,
      title: 'Someone nearby wants to connect',
      body: 'Open PingMe to accept or decline.',
      data: { type: NOTIFICATION_TYPES.ICEBREAKER_MATCH, matchId: match.id },
    });
    await this.notifications.sendToUser(targetUserId, {
      type: NOTIFICATION_TYPES.ICEBREAKER_MATCH,
      title: 'Someone nearby wants to connect',
      body: 'Open PingMe to accept or decline.',
      data: { type: NOTIFICATION_TYPES.ICEBREAKER_MATCH, matchId: match.id },
    });

    this.gateway.emitMatchUpdated(userId, {
      matchId: match.id,
      status: 'pending',
      chatId: null,
    });
    this.gateway.emitMatchUpdated(targetUserId, {
      matchId: match.id,
      status: 'pending',
      chatId: null,
    });

    return { success: true, data: { matched: true, matchId: match.id } };
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

  async expireInterests(now = new Date()) {
    const pending = await this.prisma.icebreakerInterest.findMany({
      where: {
        interested: true,
        expiresAt: { lt: now },
      },
    });

    let expiredCount = 0;

    for (const interest of pending) {
      const reverse = await this.prisma.icebreakerInterest.findUnique({
        where: {
          fromUserId_toUserId: {
            fromUserId: interest.toUserId,
            toUserId: interest.fromUserId,
          },
        },
      });

      if (isActiveYesInterest(reverse, now)) {
        continue;
      }

      await this.prisma.icebreakerInterest.update({
        where: { id: interest.id },
        data: {
          interested: false,
          expiresAt: null,
          expiredAt: now,
          hiddenUntil: null,
        },
      });
      expiredCount += 1;
    }

    return expiredCount;
  }

}

function isActiveYesInterest(
  interest:
    | {
        interested: boolean;
        expiresAt: Date | null;
        expiredAt?: Date | null;
      }
    | null
    | undefined,
  now: Date,
): boolean {
  if (!interest?.interested) return false;
  if (interest.expiredAt) return false;
  if (!interest.expiresAt) return true;
  return interest.expiresAt > now;
}

function orderUserIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function isHiddenFromList(
  interest:
    | { interested: boolean; hiddenUntil: Date | null; expiredAt?: Date | null }
    | undefined,
  now: Date,
): boolean {
  if (!interest) return false;
  if (interest.interested) return false;
  // Only hide after an explicit "No" (hiddenUntil set). Expired unanswered Yes interests
  // clear hiddenUntil and should not permanently remove someone from the list.
  if (!interest.hiddenUntil) return false;
  return interest.hiddenUntil > now;
}

function highlightPriority(highlight: 'mutual_match' | 'interested_in_you' | null): number {
  if (highlight === 'mutual_match') return 0;
  if (highlight === 'interested_in_you') return 1;
  return 2;
}
