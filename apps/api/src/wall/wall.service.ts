import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, WallPostStatus, WallReplyStatus } from '@pingme/db';
import { distanceBucket, NOTIFICATION_TYPES, CreateWallPostInput, CreateWallReplyInput } from '@pingme/shared';
import { AuditService } from '../audit/audit.service';
import { BlocksService } from '../common/services/blocks.service';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';

interface WallPostRow {
  id: string;
  user_id: string;
  content: string;
  latitude: number;
  longitude: number;
  status: string;
  reply_count: number;
  created_at: Date;
  distance_meters: number;
  display_name: string;
  avatar_url: string | null;
}

@Injectable()
export class WallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly blocks: BlocksService,
    private readonly notifications: NotificationService,
  ) {}

  async listPosts(userId: string, page = 1, limit = 20) {
    const session = await this.prisma.presenceSession.findUnique({ where: { userId } });
    if (!session?.latitude || !session?.longitude) {
      throw new BadRequestException('Location required — send a ping first');
    }

    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    const radius =
      settings?.radiusMeters ?? Number(this.config.get('DEFAULT_RADIUS_METERS', 250));
    const blockedIds = await this.blocks.getBlockedUserIds(userId);
    const offset = (page - 1) * limit;

    const blockedFilter =
      blockedIds.length > 0
        ? Prisma.sql`AND wp.user_id NOT IN (${Prisma.join(blockedIds)})`
        : Prisma.empty;

    const rows = await this.prisma.$queryRaw<WallPostRow[]>`
      SELECT
        wp.id,
        wp.user_id,
        wp.content,
        wp.latitude,
        wp.longitude,
        wp.status,
        wp.reply_count,
        wp.created_at,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(wp.longitude, wp.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${session.longitude}, ${session.latitude}), 4326)::geography
        ) AS distance_meters,
        p.display_name,
        p.avatar_url
      FROM wall_posts wp
      INNER JOIN profiles p ON p.user_id = wp.user_id
      WHERE wp.status = 'active'
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(wp.longitude, wp.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${session.longitude}, ${session.latitude}), 4326)::geography,
          ${radius}
        )
        ${blockedFilter}
      ORDER BY wp.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const data = rows.map((row) => ({
      id: row.id,
      content: row.content,
      replyCount: row.reply_count,
      createdAt: row.created_at,
      distanceBucket: distanceBucket(Number(row.distance_meters)),
      author: {
        id: row.user_id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        isYou: row.user_id === userId,
      },
    }));

    return { success: true, data, meta: { page, limit, radiusMeters: radius } };
  }

  async createPost(userId: string, dto: CreateWallPostInput) {
    const post = await this.prisma.wallPost.create({
      data: {
        userId,
        content: dto.content.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        status: WallPostStatus.active,
      },
    });

    await this.audit.log({
      userId,
      action: 'post.create',
      entityType: 'wall_post',
      entityId: post.id,
      metadata: { accuracy: dto.accuracy },
    });

    return { success: true, data: post };
  }

  async getPost(userId: string, postId: string) {
    const blockedIds = await this.blocks.getBlockedUserIds(userId);
    const post = await this.prisma.wallPost.findFirst({
      where: {
        id: postId,
        status: WallPostStatus.active,
        userId: blockedIds.length ? { notIn: blockedIds } : undefined,
      },
      include: {
        user: { include: { profile: true } },
        replies: {
          where: {
            status: WallReplyStatus.active,
            userId: blockedIds.length ? { notIn: blockedIds } : undefined,
          },
          orderBy: { createdAt: 'asc' },
          include: { user: { include: { profile: true } } },
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

    return {
      success: true,
      data: {
        id: post.id,
        content: post.content,
        replyCount: post.replyCount,
        createdAt: post.createdAt,
        distanceBucket: distanceBucketValue,
        author: {
          id: post.userId,
          displayName: post.user.profile?.displayName,
          avatarUrl: post.user.profile?.avatarUrl,
          isYou: post.userId === userId,
        },
        replies: post.replies.map((reply) => ({
          id: reply.id,
          content: reply.content,
          createdAt: reply.createdAt,
          author: {
            id: reply.userId,
            displayName: reply.user.profile?.displayName,
            avatarUrl: reply.user.profile?.avatarUrl,
            isYou: reply.userId === userId,
          },
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
        title: 'New reply on your post',
        body: dto.content.trim().slice(0, 80),
        data: {
          type: NOTIFICATION_TYPES.WALL_REPLY,
          postId,
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
