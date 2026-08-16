import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChatStatus,
  EventCommentStatus,
  EventRsvpStatus,
  EventStatus,
  MatchSource,
  MatchStatus,
  Prisma,
  UserStatus,
} from '@pingme/db';
import {
  CreateEventCommentInput,
  CreateEventInput,
  EventImageConfirmInput,
  EventRsvpInput,
  MAX_EVENT_IMAGES,
  MessageEventHostInput,
  NOTIFICATION_TYPES,
  UpdateEventInput,
  distanceBucket,
} from '@pingme/shared';
import { AuditService } from '../audit/audit.service';
import { AppConfigService } from '../config/app-config.service';
import { BlocksService } from '../common/services/blocks.service';
import { R2Service } from '../common/services/r2.service';
import { assertSafeEventObjectKey } from '../common/utils/upload-key.util';
import { getPublicProfileFields, loadLivenessVerifiedSet } from '../common/utils/public-profile.util';
import { PrismaService } from '../prisma/prisma.service';
import { EventsNearbyPushService } from './events-nearby-push.service';
import { NotificationService } from '../notifications/notification.service';

interface EventNearbyRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  place_name: string | null;
  address: string | null;
  starts_at: Date;
  ends_at: Date;
  allow_messages: boolean;
  status: string;
  going_count: number;
  maybe_count: number;
  comment_count: number;
  created_at: Date;
  distance_meters: number;
  display_name: string;
  avatar_url: string | null;
  avatar_config: unknown;
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_period_end: Date | null;
  liveness_verified: boolean;
  cover_url: string | null;
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
    private readonly blocks: BlocksService,
    private readonly audit: AuditService,
    private readonly eventsPush: EventsNearbyPushService,
    private readonly notifications: NotificationService,
    private readonly r2: R2Service,
  ) {}

  async listNearby(userId: string, page = 1, limit = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Math.min(50, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 20));
    const session = await this.prisma.presenceSession.findUnique({ where: { userId } });
    if (!session?.latitude || !session?.longitude) {
      throw new BadRequestException('Location required — send a ping first');
    }

    const radius = this.appConfig.getDistanceConfig().events.discoveryRadiusMeters;
    const blockedIds = await this.blocks.getBlockedUserIds(userId);
    const offset = (safePage - 1) * safeLimit;
    const now = new Date();

    const blockedFilter =
      blockedIds.length > 0
        ? Prisma.sql`AND e.user_id NOT IN (${Prisma.join(
            blockedIds.map((id) => Prisma.sql`${id}::uuid`),
          )})`
        : Prisma.empty;

    const rows = await this.prisma.$queryRaw<EventNearbyRow[]>`
      SELECT
        e.id,
        e.user_id,
        e.title,
        e.description,
        e.latitude,
        e.longitude,
        e.place_name,
        e.address,
        e.starts_at,
        e.ends_at,
        e.allow_messages,
        e.status,
        e.going_count,
        e.maybe_count,
        e.comment_count,
        e.created_at,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${session.longitude}, ${session.latitude}), 4326)::geography
        ) AS distance_meters,
        p.display_name,
        p.avatar_url,
        p.avatar_config,
        sub.plan AS subscription_plan,
        sub.status AS subscription_status,
        sub.current_period_end AS subscription_period_end,
        EXISTS (
          SELECT 1 FROM verifications v
          WHERE v.user_id = e.user_id
            AND v.type = 'liveness'
            AND v.status = 'passed'
            AND (v.expires_at IS NULL OR v.expires_at > NOW())
        ) AS liveness_verified,
        (
          SELECT ei.url FROM event_images ei
          WHERE ei.event_id = e.id AND ei.is_cover = true
          ORDER BY ei.sort_order ASC
          LIMIT 1
        ) AS cover_url
      FROM events e
      INNER JOIN profiles p ON p.user_id = e.user_id
      INNER JOIN users u ON u.id = e.user_id
        AND u.deleted_at IS NULL
        AND u.status <> 'deleted'
      LEFT JOIN subscriptions sub ON sub.user_id = e.user_id
      WHERE e.status = 'active'
        AND e.ends_at > ${now}
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${session.longitude}, ${session.latitude}), 4326)::geography,
          ${radius}
        )
        ${blockedFilter}
      ORDER BY e.starts_at ASC
      LIMIT ${safeLimit} OFFSET ${offset}
    `;

    const data = rows.map((row) => this.serializeListItem(row, userId));

    return {
      success: true,
      data,
      meta: {
        page: safePage,
        limit: safeLimit,
        radiusMeters: radius,
        hasMore: rows.length === safeLimit,
      },
    };
  }

  async listMine(userId: string) {
    const events = await this.prisma.event.findMany({
      where: {
        userId,
        status: { in: [EventStatus.active, EventStatus.cancelled] },
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { startsAt: 'desc' },
    });

    return {
      success: true,
      data: events.map((event) => ({
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        status: event.status,
        goingCount: event.goingCount,
        maybeCount: event.maybeCount,
        coverUrl: event.images.find((img) => img.isCover)?.url ?? event.images[0]?.url ?? null,
        isHost: true,
      })),
    };
  }

  async listAttending(userId: string, page = 1, limit = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Math.min(50, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 20));
    const offset = (safePage - 1) * safeLimit;
    const now = new Date();
    const blockedIds = await this.blocks.getBlockedUserIds(userId);
    const session = await this.prisma.presenceSession.findUnique({ where: { userId } });

    const where: Prisma.EventWhereInput = {
      status: EventStatus.active,
      endsAt: { gt: now },
      ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
      user: { deletedAt: null, NOT: { status: UserStatus.deleted } },
      rsvps: {
        some: {
          userId,
          status: { in: [EventRsvpStatus.going, EventRsvpStatus.maybe] },
        },
      },
    };

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          user: { include: { profile: true, subscription: true } },
          rsvps: { where: { userId } },
        },
        orderBy: { startsAt: 'asc' },
        skip: offset,
        take: safeLimit,
      }),
      this.prisma.event.count({ where }),
    ]);

    const verifiedSet = await loadLivenessVerifiedSet(
      this.prisma,
      events.map((event) => event.userId),
    );

    const data = events.map((event) => {
      const rsvp = event.rsvps[0];
      const viewerRsvp =
        rsvp?.status === EventRsvpStatus.going || rsvp?.status === EventRsvpStatus.maybe
          ? rsvp.status
          : null;
      const flair = getPublicProfileFields(
        event.user.profile,
        event.user.subscription,
        verifiedSet.has(event.userId),
      );

      let distanceBucketValue = 'nearby';
      if (
        session?.latitude != null &&
        session?.longitude != null &&
        event.latitude != null &&
        event.longitude != null
      ) {
        distanceBucketValue = distanceBucket(
          haversineMeters(session.latitude, session.longitude, event.latitude, event.longitude),
        );
      }

      return {
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        placeName: event.placeName,
        goingCount: event.goingCount,
        maybeCount: event.maybeCount,
        coverUrl: event.images.find((img) => img.isCover)?.url ?? event.images[0]?.url ?? null,
        distanceBucket: distanceBucketValue,
        viewerRsvp,
        host: {
          id: event.userId,
          displayName: event.user.profile?.displayName ?? 'User',
          avatarUrl: event.user.profile?.avatarUrl ?? null,
          isYou: event.userId === userId,
          isPremium: flair.isPremium,
          avatarTheme: flair.avatarTheme,
          livenessVerified: flair.livenessVerified,
        },
      };
    });

    return {
      success: true,
      data,
      meta: {
        page: safePage,
        limit: safeLimit,
        hasMore: offset + events.length < total,
      },
    };
  }

  async getEvent(userId: string, eventId: string) {
    const blockedIds = await this.blocks.getBlockedUserIds(userId);
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        status: { in: [EventStatus.active, EventStatus.cancelled] },
        userId: blockedIds.length ? { notIn: blockedIds } : undefined,
        user: { deletedAt: null, NOT: { status: UserStatus.deleted } },
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        user: { include: { profile: true, subscription: true } },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const viewerRsvp = await this.prisma.eventRsvp.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    const session = await this.prisma.presenceSession.findUnique({ where: { userId } });
    let distanceBucketValue = 'nearby';
    if (session?.latitude && session?.longitude) {
      const [result] = await this.prisma.$queryRaw<{ distance_meters: number }[]>`
        SELECT ST_Distance(
          ST_SetSRID(ST_MakePoint(${event.longitude}, ${event.latitude}), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${session.longitude}, ${session.latitude}), 4326)::geography
        ) AS distance_meters
      `;
      if (result) {
        distanceBucketValue = distanceBucket(Number(result.distance_meters));
      }
    }

    const verifiedSet = await loadLivenessVerifiedSet(this.prisma, [event.userId]);
    const hostFlair = getPublicProfileFields(
      event.user.profile,
      event.user.subscription,
      verifiedSet.has(event.userId),
    );

    const idVerified = await this.prisma.verification.findFirst({
      where: {
        userId: event.userId,
        type: 'document',
        status: 'passed',
      },
      select: { id: true },
    });

    return {
      success: true,
      data: {
        id: event.id,
        title: event.title,
        description: event.description,
        latitude: event.latitude,
        longitude: event.longitude,
        placeName: event.placeName,
        address: event.address,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        allowMessages: event.allowMessages,
        status: event.status,
        goingCount: event.goingCount,
        maybeCount: event.maybeCount,
        commentCount: event.commentCount,
        distanceBucket: distanceBucketValue,
        images: event.images.map((img) => ({
          id: img.id,
          url: img.url,
          isCover: img.isCover,
          sortOrder: img.sortOrder,
        })),
        host: {
          id: event.userId,
          displayName: event.user.profile?.displayName ?? 'User',
          avatarUrl: event.user.profile?.avatarUrl ?? null,
          isPremium: hostFlair.isPremium,
          avatarTheme: hostFlair.avatarTheme,
          livenessVerified: hostFlair.livenessVerified,
          idVerified: Boolean(idVerified),
          isYou: event.userId === userId,
        },
        viewerRsvp:
          viewerRsvp && viewerRsvp.status !== EventRsvpStatus.cancelled
            ? viewerRsvp.status
            : null,
        isHost: event.userId === userId,
      },
    };
  }

  async createEvent(userId: string, dto: CreateEventInput) {
    const event = await this.prisma.event.create({
      data: {
        userId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        placeName: dto.placeName?.trim() || null,
        address: dto.address?.trim() || null,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        allowMessages: dto.allowMessages ?? true,
        status: EventStatus.active,
      },
    });

    await this.audit.log({
      userId,
      action: 'event.create',
      entityType: 'event',
      entityId: event.id,
    });

    void this.eventsPush.notifyNearbyUsersOnCreate(
      userId,
      event.id,
      event.title,
      event.latitude,
      event.longitude,
    );

    return {
      success: true,
      data: { id: event.id },
    };
  }

  async updateEvent(userId: string, eventId: string, dto: UpdateEventInput) {
    const event = await this.getHostEvent(userId, eventId);

    const updated = await this.prisma.event.update({
      where: { id: event.id },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        placeName: dto.placeName === undefined ? undefined : dto.placeName,
        address: dto.address === undefined ? undefined : dto.address,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        allowMessages: dto.allowMessages,
      },
    });

    await this.audit.log({
      userId,
      action: 'event.update',
      entityType: 'event',
      entityId: eventId,
    });

    return { success: true, data: { id: updated.id } };
  }

  async cancelEvent(userId: string, eventId: string) {
    const event = await this.getHostEvent(userId, eventId);

    await this.prisma.event.update({
      where: { id: event.id },
      data: { status: EventStatus.cancelled },
    });

    await this.audit.log({
      userId,
      action: 'event.cancel',
      entityType: 'event',
      entityId: eventId,
    });

    return { success: true, data: { cancelled: true } };
  }

  async addImages(userId: string, eventId: string, dto: EventImageConfirmInput) {
    await this.getHostEvent(userId, eventId);

    const existingCount = await this.prisma.eventImage.count({ where: { eventId } });
    if (existingCount + dto.images.length > MAX_EVENT_IMAGES) {
      throw new BadRequestException(`Events can have at most ${MAX_EVENT_IMAGES} images`);
    }

    const hasCover = dto.images.some((img) => img.isCover);
    if (!hasCover && existingCount === 0 && dto.images.length > 0) {
      dto.images[0].isCover = true;
    }

    if (hasCover) {
      await this.prisma.eventImage.updateMany({
        where: { eventId },
        data: { isCover: false },
      });
    }

    await this.prisma.eventImage.createMany({
      data: dto.images.map((img, index) => ({
        eventId,
        url: img.url,
        isCover: img.isCover ?? (existingCount === 0 && index === 0),
        sortOrder: img.sortOrder ?? existingCount + index,
      })),
    });

    return { success: true };
  }

  async presignImage(
    userId: string,
    eventId: string,
    fileName: string,
    contentType: string,
  ) {
    await this.getHostEvent(userId, eventId);
    const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 180) || 'image.jpg';
    const key = `events/${eventId}/${Date.now()}-${safeName}`;
    const presign = await this.r2.createPresignedUpload(key, contentType);
    return {
      success: true,
      data: {
        ...presign,
        key,
        publicUrl: this.r2.getPublicUrl(key),
      },
    };
  }

  async uploadImageDirect(
    userId: string,
    eventId: string,
    key: string,
    file: { buffer: Buffer; mimetype: string },
  ) {
    if (this.r2.isConfigured()) {
      throw new BadRequestException('Direct upload is only used when R2 is not configured');
    }

    await this.getHostEvent(userId, eventId);
    const safeKey = assertSafeEventObjectKey(eventId, key);

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    const publicUrl = await this.r2.saveLocalFile(safeKey, file.buffer);
    return { success: true, data: { publicUrl, key: safeKey } };
  }

  async removeImage(userId: string, eventId: string, imageId: string) {
    await this.getHostEvent(userId, eventId);

    const image = await this.prisma.eventImage.findFirst({
      where: { id: imageId, eventId },
    });
    if (!image) {
      throw new NotFoundException('Image not found');
    }

    await this.prisma.eventImage.delete({ where: { id: imageId } });
    return { success: true, data: { removed: true } };
  }

  async upsertRsvp(userId: string, eventId: string, dto: EventRsvpInput) {
    const event = await this.getActiveEvent(eventId);
    if (event.userId === userId) {
      throw new BadRequestException('Hosts cannot RSVP to their own event');
    }

    const existing = await this.prisma.eventRsvp.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    const oldStatus = existing?.status;
    const newStatus =
      dto.status === 'going' ? EventRsvpStatus.going : EventRsvpStatus.maybe;

    await this.prisma.$transaction(async (tx) => {
      await tx.eventRsvp.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: { eventId, userId, status: newStatus },
        update: { status: newStatus },
      });

      const goingDelta =
        (newStatus === EventRsvpStatus.going ? 1 : 0) -
        (oldStatus === EventRsvpStatus.going ? 1 : 0);
      const maybeDelta =
        (newStatus === EventRsvpStatus.maybe ? 1 : 0) -
        (oldStatus === EventRsvpStatus.maybe ? 1 : 0);

      if (goingDelta !== 0 || maybeDelta !== 0) {
        await tx.event.update({
          where: { id: eventId },
          data: {
            goingCount: { increment: goingDelta },
            maybeCount: { increment: maybeDelta },
          },
        });
      }
    });

    return { success: true, data: { status: dto.status } };
  }

  async cancelRsvp(userId: string, eventId: string) {
    const existing = await this.prisma.eventRsvp.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!existing || existing.status === EventRsvpStatus.cancelled) {
      return { success: true, data: { cancelled: true } };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.eventRsvp.update({
        where: { eventId_userId: { eventId, userId } },
        data: { status: EventRsvpStatus.cancelled },
      });

      const goingDelta = existing.status === EventRsvpStatus.going ? -1 : 0;
      const maybeDelta = existing.status === EventRsvpStatus.maybe ? -1 : 0;

      if (goingDelta !== 0 || maybeDelta !== 0) {
        await tx.event.update({
          where: { id: eventId },
          data: {
            goingCount: { increment: goingDelta },
            maybeCount: { increment: maybeDelta },
          },
        });
      }
    });

    return { success: true, data: { cancelled: true } };
  }

  async listComments(userId: string, eventId: string, page = 1, limit = 30) {
    await this.getActiveEvent(eventId);

    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Math.min(50, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 30));
    const blockedIds = await this.blocks.getBlockedUserIds(userId);
    const offset = (safePage - 1) * safeLimit;

    const comments = await this.prisma.eventComment.findMany({
      where: {
        eventId,
        status: EventCommentStatus.active,
        userId: blockedIds.length ? { notIn: blockedIds } : undefined,
      },
      include: {
        user: { include: { profile: true, subscription: true } },
      },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: safeLimit,
    });

    const authorIds = comments.map((c) => c.userId);
    const verifiedSet = await loadLivenessVerifiedSet(this.prisma, authorIds);

    return {
      success: true,
      data: comments.map((comment) => {
        const flair = getPublicProfileFields(
          comment.user.profile,
          comment.user.subscription,
          verifiedSet.has(comment.userId),
        );
        return {
          id: comment.id,
          parentId: comment.parentId,
          content: comment.content,
          createdAt: comment.createdAt,
          author: {
            id: comment.userId,
            displayName: comment.user.profile?.displayName ?? 'User',
            avatarUrl: comment.user.profile?.avatarUrl ?? null,
            isYou: comment.userId === userId,
            isPremium: flair.isPremium,
            avatarTheme: flair.avatarTheme,
            livenessVerified: flair.livenessVerified,
            gender: flair.gender,
          },
        };
      }),
      meta: { page: safePage, limit: safeLimit, hasMore: comments.length === safeLimit },
    };
  }

  async createComment(userId: string, eventId: string, dto: CreateEventCommentInput) {
    await this.getActiveEvent(eventId);

    let parentComment: { id: string; userId: string; parentId: string | null } | null = null;
    if (dto.parentId) {
      parentComment = await this.prisma.eventComment.findFirst({
        where: {
          id: dto.parentId,
          eventId,
          status: EventCommentStatus.active,
        },
        select: { id: true, userId: true, parentId: true },
      });
      if (!parentComment) {
        throw new NotFoundException('Comment not found');
      }
    }

    const parentId = parentComment
      ? parentComment.parentId ?? parentComment.id
      : null;

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.eventComment.create({
        data: {
          eventId,
          userId,
          parentId,
          content: dto.content.trim(),
          status: EventCommentStatus.active,
        },
      });
      await tx.event.update({
        where: { id: eventId },
        data: { commentCount: { increment: 1 } },
      });
      return created;
    });

    const notifyUserId = parentComment?.userId;
    if (notifyUserId && notifyUserId !== userId) {
      await this.notifications.sendToUser(notifyUserId, {
        type: NOTIFICATION_TYPES.EVENT_COMMENT_REPLY,
        title: 'New reply on an event',
        body: dto.content.trim().slice(0, 80),
        data: {
          type: NOTIFICATION_TYPES.EVENT_COMMENT_REPLY,
          eventId: String(eventId),
          commentId: String(comment.id),
          parentId: parentId ? String(parentId) : '',
        },
      });
    }

    return { success: true, data: { id: comment.id, parentId: comment.parentId } };
  }

  async deleteComment(userId: string, eventId: string, commentId: string) {
    const comment = await this.prisma.eventComment.findFirst({
      where: { id: commentId, eventId, status: EventCommentStatus.active },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.userId !== userId) {
      throw new ForbiddenException('Not allowed to delete this comment');
    }

    const replyCount = comment.parentId
      ? 0
      : await this.prisma.eventComment.count({
          where: {
            parentId: commentId,
            status: EventCommentStatus.active,
          },
        });
    const totalRemoved = 1 + replyCount;

    await this.prisma.$transaction(async (tx) => {
      await tx.eventComment.update({
        where: { id: commentId },
        data: { status: EventCommentStatus.deleted },
      });
      if (!comment.parentId) {
        await tx.eventComment.updateMany({
          where: { parentId: commentId, status: EventCommentStatus.active },
          data: { status: EventCommentStatus.deleted },
        });
      }
      await tx.event.update({
        where: { id: eventId },
        data: { commentCount: { decrement: totalRemoved } },
      });
    });

    return { success: true };
  }

  async messageHost(userId: string, eventId: string, dto: MessageEventHostInput) {
    const event = await this.getActiveEvent(eventId);
    if (!event.allowMessages) {
      throw new BadRequestException('Host has disabled messages for this event');
    }
    if (event.userId === userId) {
      throw new BadRequestException('Cannot message yourself');
    }

    const blocked = await this.blocks.getBlockedUserIds(userId);
    if (blocked.includes(event.userId)) {
      throw new BadRequestException('Cannot message blocked user');
    }

    const [userAId, userBId] = orderUserIds(userId, event.userId);

    let match = await this.prisma.match.findFirst({
      where: {
        userAId,
        userBId,
        source: MatchSource.event,
        sourceReferenceId: eventId,
        status: { in: [MatchStatus.pending, MatchStatus.active] },
      },
      include: { chat: true },
    });

    if (!match) {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      match = await this.prisma.match.create({
        data: {
          userAId,
          userBId,
          source: MatchSource.event,
          sourceReferenceId: eventId,
          status: MatchStatus.active,
          expiresAt,
          userAAcceptedAt: new Date(),
          userBAcceptedAt: new Date(),
        },
        include: { chat: true },
      });
    } else if (match.status === MatchStatus.pending) {
      match = await this.prisma.match.update({
        where: { id: match.id },
        data: {
          status: MatchStatus.active,
          userAAcceptedAt: match.userAAcceptedAt ?? new Date(),
          userBAcceptedAt: match.userBAcceptedAt ?? new Date(),
        },
        include: { chat: true },
      });
    }

    const chat = await this.prisma.chat.upsert({
      where: { matchId: match.id },
      create: { matchId: match.id, status: ChatStatus.active },
      update: {},
    });

    if (dto.message?.trim()) {
      await this.prisma.message.create({
        data: {
          chatId: chat.id,
          senderId: userId,
          content: dto.message.trim(),
        },
      });
    }

    return { success: true, data: { chatId: chat.id } };
  }

  private serializeListItem(row: EventNearbyRow, userId: string) {
    const flair = getPublicProfileFields(
      { avatarConfig: row.avatar_config },
      row.subscription_plan
        ? {
            plan: row.subscription_plan,
            status: row.subscription_status ?? 'active',
            currentPeriodEnd: row.subscription_period_end,
          }
        : null,
      row.liveness_verified,
    );

    return {
      id: row.id,
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      placeName: row.place_name,
      goingCount: row.going_count,
      maybeCount: row.maybe_count,
      coverUrl: row.cover_url,
      distanceBucket: distanceBucket(Number(row.distance_meters)),
      host: {
        id: row.user_id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        isYou: row.user_id === userId,
        isPremium: flair.isPremium,
        avatarTheme: flair.avatarTheme,
        livenessVerified: flair.livenessVerified,
      },
    };
  }

  private async getHostEvent(userId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        userId,
        status: { in: [EventStatus.active, EventStatus.cancelled] },
      },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  private async getActiveEvent(eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        status: EventStatus.active,
        endsAt: { gt: new Date() },
        user: { deletedAt: null, NOT: { status: UserStatus.deleted } },
      },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }
}

function orderUserIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a));
}
