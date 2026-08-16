import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus, WallPostStatus, WallReplyStatus } from '@pingme/db';
import { distanceBucket, NOTIFICATION_TYPES, WALL_POST_MAX_AGE_HOURS, CreateWallPostInput, CreateWallReplyInput } from '@pingme/shared';
import { AuditService } from '../audit/audit.service';
import { AppConfigService } from '../config/app-config.service';
import { BlocksService } from '../common/services/blocks.service';
import { getPublicProfileFields, loadLivenessVerifiedSet } from '../common/utils/public-profile.util';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';

interface WallPostRow {
  id: string;
  user_id: string;
  content: string;
  latitude: number;
  longitude: number;
  status: string;
  show_photo: boolean;
  reply_count: number;
  created_at: Date;
  distance_meters: number;
  display_name: string;
  avatar_url: string | null;
  avatar_config: unknown;
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_period_end: Date | null;
  liveness_verified: boolean;
}

@Injectable()
export class WallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
    private readonly audit: AuditService,
    private readonly blocks: BlocksService,
    private readonly notifications: NotificationService,
  ) {}

  async listPosts(userId: string, page = 1, limit = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Math.min(50, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 20));
    const session = await this.prisma.presenceSession.findUnique({ where: { userId } });
    if (!session?.latitude || !session?.longitude) {
      throw new BadRequestException('Location required — send a ping first');
    }

    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    const radius = this.appConfig.resolveWallRadius(settings?.radiusMeters);
    const blockedIds = await this.blocks.getBlockedUserIds(userId);
    const offset = (safePage - 1) * safeLimit;
    const cutoff = new Date(Date.now() - WALL_POST_MAX_AGE_HOURS * 60 * 60 * 1000);

    const blockedFilter =
      blockedIds.length > 0
        ? Prisma.sql`AND wp.user_id NOT IN (${Prisma.join(
            blockedIds.map((id) => Prisma.sql`${id}::uuid`),
          )})`
        : Prisma.empty;

    const rows = await this.prisma.$queryRaw<WallPostRow[]>`
      SELECT
        wp.id,
        wp.user_id,
        wp.content,
        wp.latitude,
        wp.longitude,
        wp.status,
        wp.show_photo,
        wp.reply_count,
        wp.created_at,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(wp.longitude, wp.latitude), 4326)::geography,
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
          WHERE v.user_id = wp.user_id
            AND v.type = 'liveness'
            AND v.status = 'passed'
            AND (v.expires_at IS NULL OR v.expires_at > NOW())
        ) AS liveness_verified
      FROM wall_posts wp
      INNER JOIN profiles p ON p.user_id = wp.user_id
      INNER JOIN users u ON u.id = wp.user_id
        AND u.deleted_at IS NULL
        AND u.status <> 'deleted'
      LEFT JOIN subscriptions sub ON sub.user_id = wp.user_id
      WHERE wp.status = 'active'
        AND wp.created_at >= ${cutoff}
        AND (wp.expires_at IS NULL OR wp.expires_at > NOW())
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(wp.longitude, wp.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${session.longitude}, ${session.latitude}), 4326)::geography,
          ${radius}
        )
        ${blockedFilter}
      ORDER BY wp.created_at DESC
      LIMIT ${safeLimit} OFFSET ${offset}
    `;

    const data = rows.map((row) => {
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
      content: row.content,
      replyCount: row.reply_count,
      createdAt: row.created_at,
      distanceBucket: distanceBucket(Number(row.distance_meters)),
      author: {
        id: row.user_id,
        displayName: row.display_name,
        avatarUrl: row.show_photo ? row.avatar_url : null,
        isYou: row.user_id === userId,
        isPremium: flair.isPremium,
        avatarTheme: flair.avatarTheme,
        livenessVerified: flair.livenessVerified,
      },
    };
    });

    const hasMore = rows.length === safeLimit;

    return {
      success: true,
      data,
      meta: {
        page: safePage,
        limit: safeLimit,
        radiusMeters: radius,
        hasMore,
        maxAgeHours: WALL_POST_MAX_AGE_HOURS,
      },
    };
  }

  async createPost(userId: string, dto: CreateWallPostInput) {
    const expiresAt = new Date(Date.now() + WALL_POST_MAX_AGE_HOURS * 60 * 60 * 1000);
    const post = await this.prisma.wallPost.create({
      data: {
        userId,
        content: dto.content.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        showPhoto: dto.showPhoto ?? false,
        status: WallPostStatus.active,
        expiresAt,
      },
    });

    await this.audit.log({
      userId,
      action: 'post.create',
      entityType: 'wall_post',
      entityId: post.id,
      metadata: { accuracy: dto.accuracy },
    });

    return {
      success: true,
      data: {
        id: post.id,
        content: post.content,
        showPhoto: post.showPhoto,
        status: post.status,
        replyCount: post.replyCount,
        createdAt: post.createdAt,
        expiresAt: post.expiresAt,
        distanceBucket: 'nearby',
        author: {
          id: userId,
          isYou: true,
        },
      },
    };
  }

  async getPost(userId: string, postId: string) {
    const blockedIds = await this.blocks.getBlockedUserIds(userId);
    const post = await this.prisma.wallPost.findFirst({
      where: {
        id: postId,
        status: WallPostStatus.active,
        createdAt: { gte: new Date(Date.now() - WALL_POST_MAX_AGE_HOURS * 60 * 60 * 1000) },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        userId: blockedIds.length ? { notIn: blockedIds } : undefined,
        user: { deletedAt: null, NOT: { status: UserStatus.deleted } },
      },
      include: {
        user: { include: { profile: true, subscription: true } },
        replies: {
          where: {
            status: WallReplyStatus.active,
            userId: blockedIds.length ? { notIn: blockedIds } : undefined,
          },
          orderBy: { createdAt: 'asc' },
          include: { user: { include: { profile: true, subscription: true } } },
        },
      },
    });

    if (!post) throw new NotFoundException('Post not found');

    const session = await this.prisma.presenceSession.findUnique({ where: { userId } });
    let distanceBucketValue = 'nearby';
    if (session?.latitude && session?.longitude) {
      const [result] = await this.prisma.$queryRaw<{ distance_meters: number }[]>`
        SELECT ST_Distance(
          ST_SetSRID(ST_MakePoint(${post.longitude}, ${post.latitude}), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${session.longitude}, ${session.latitude}), 4326)::geography
        ) AS distance_meters
      `;
      if (result) distanceBucketValue = distanceBucket(Number(result.distance_meters));
    }

    const authorIds = [post.userId, ...post.replies.map((reply) => reply.userId)];
    const verifiedSet = await loadLivenessVerifiedSet(this.prisma, authorIds);

    const mapAuthor = (
      authorId: string,
      profile: { displayName: string; avatarUrl?: string | null; avatarConfig?: unknown } | null | undefined,
      subscription: { plan: string; status: string; currentPeriodEnd: Date | null } | null | undefined,
      avatarUrl: string | null | undefined,
    ) => {
      const flair = getPublicProfileFields(profile, subscription ?? null, verifiedSet.has(authorId));
      return {
        id: authorId,
        displayName: profile?.displayName,
        avatarUrl: avatarUrl ?? null,
        isYou: authorId === userId,
        isPremium: flair.isPremium,
        avatarTheme: flair.avatarTheme,
        livenessVerified: flair.livenessVerified,
      };
    };

    return {
      success: true,
      data: {
        id: post.id,
        content: post.content,
        replyCount: post.replyCount,
        createdAt: post.createdAt,
        distanceBucket: distanceBucketValue,
        author: mapAuthor(
          post.userId,
          post.user.profile,
          post.user.subscription,
          post.showPhoto ? post.user.profile?.avatarUrl ?? null : null,
        ),
        replies: post.replies.map((reply) => ({
          id: reply.id,
          content: reply.content,
          createdAt: reply.createdAt,
          author: mapAuthor(
            reply.userId,
            reply.user.profile,
            reply.user.subscription,
            reply.user.profile?.avatarUrl,
          ),
        })),
      },
    };
  }

  async deletePost(userId: string, postId: string) {
    const post = await this.prisma.wallPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.userId !== userId) throw new ForbiddenException('Not your post');

    await this.prisma.wallPost.update({
      where: { id: postId },
      data: { status: WallPostStatus.deleted },
    });

    await this.audit.log({
      userId,
      action: 'post.delete',
      entityType: 'wall_post',
      entityId: postId,
    });

    return { success: true };
  }

  async createReply(userId: string, postId: string, dto: CreateWallReplyInput) {
    const post = await this.prisma.wallPost.findFirst({
      where: { id: postId, status: WallPostStatus.active },
    });
    if (!post) throw new NotFoundException('Post not found');

    const reply = await this.prisma.$transaction(async (tx) => {
      const created = await tx.wallReply.create({
        data: {
          postId,
          userId,
          content: dto.content.trim(),
          status: WallReplyStatus.active,
        },
      });
      await tx.wallPost.update({
        where: { id: postId },
        data: { replyCount: { increment: 1 } },
      });
      return created;
    });

    await this.audit.log({
      userId,
      action: 'reply.create',
      entityType: 'wall_reply',
      entityId: reply.id,
      metadata: { postId },
    });

    if (post.userId !== userId) {
      await this.notifications.sendToUser(post.userId, {
        type: NOTIFICATION_TYPES.WALL_REPLY,
        title: 'Someone replied on your post',
        body: dto.content.trim().slice(0, 80),
        data: {
          type: NOTIFICATION_TYPES.WALL_REPLY,
          postId: String(postId),
          replyId: String(reply.id),
        },
      });
    }

    return { success: true, data: reply };
  }

  async deleteReply(userId: string, replyId: string) {
    const reply = await this.prisma.wallReply.findUnique({ where: { id: replyId } });
    if (!reply) throw new NotFoundException('Reply not found');
    if (reply.userId !== userId) throw new ForbiddenException('Not your reply');

    await this.prisma.$transaction(async (tx) => {
      await tx.wallReply.update({
        where: { id: replyId },
        data: { status: WallReplyStatus.deleted },
      });
      await tx.wallPost.update({
        where: { id: reply.postId },
        data: { replyCount: { decrement: 1 } },
      });
    });

    return { success: true };
  }
}
