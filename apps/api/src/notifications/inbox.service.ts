import { Injectable } from '@nestjs/common';
import {
  MatchSource,
  MatchStatus,
  UserNotificationType,
  WallPostStatus,
  WallReplyStatus,
} from '@pingme/db';
import { NOTIFICATION_TYPES, WALL_POST_MAX_AGE_HOURS } from '@pingme/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';

@Injectable()
export class InboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async getSummary(userId: string) {
    const [wallUnread, icebreakerUnread] = await Promise.all([
      this.prisma.userNotification.count({
        where: { userId, readAt: null, ...this.activeWallPostFilter() },
      }),
      this.countIcebreakerUnread(userId),
    ]);

    return {
      wallUnread,
      icebreakerUnread,
    };
  }

  async listWallNotifications(userId: string, limit = 30) {
    const items = await this.prisma.userNotification.findMany({
      where: { userId, ...this.activeWallPostFilter() },
      orderBy: { createdAt: 'desc' },
      take: Math.min(50, Math.max(1, limit)),
      include: {
        post: { select: { id: true, content: true, status: true, createdAt: true } },
        reply: {
          select: {
            id: true,
            content: true,
            user: { include: { profile: { select: { displayName: true } } } },
          },
        },
      },
    });

    const unreadCount = await this.prisma.userNotification.count({
      where: { userId, readAt: null, ...this.activeWallPostFilter() },
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        postId: item.postId,
        replyId: item.replyId,
        readAt: item.readAt,
        createdAt: item.createdAt,
        postPreview: item.post.content.slice(0, 120),
        replyPreview: item.reply.content.slice(0, 120),
        actorDisplayName: item.reply.user.profile?.displayName ?? 'Someone nearby',
        title:
          item.type === UserNotificationType.wall_reply_on_post
            ? 'New reply on your post'
            : 'New reply on a thread you joined',
      })),
      unreadCount,
    };
  }

  async markWallNotificationsRead(userId: string, postId?: string) {
    await this.prisma.userNotification.updateMany({
      where: {
        userId,
        readAt: null,
        ...(postId ? { postId } : {}),
      },
      data: { readAt: new Date() },
    });

    return { success: true };
  }

  async clearWallNotifications(userId: string) {
    await this.prisma.userNotification.deleteMany({ where: { userId } });
    return { success: true };
  }

  async createWallReplyNotifications(params: {
    postId: string;
    postAuthorId: string;
    replyId: string;
    replierId: string;
    replyPreview: string;
  }) {
    const { postId, postAuthorId, replyId, replierId, replyPreview } = params;

    const threadParticipants = await this.prisma.wallReply.findMany({
      where: {
        postId,
        status: WallReplyStatus.active,
        userId: { not: replierId },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    const recipients = new Map<string, UserNotificationType>();

    if (postAuthorId !== replierId) {
      recipients.set(postAuthorId, UserNotificationType.wall_reply_on_post);
    }

    for (const participant of threadParticipants) {
      if (participant.userId === postAuthorId) continue;
      recipients.set(participant.userId, UserNotificationType.wall_reply_on_thread);
    }

    for (const [recipientId, type] of recipients) {
      await this.prisma.userNotification.upsert({
        where: {
          userId_replyId: { userId: recipientId, replyId },
        },
        create: {
          userId: recipientId,
          type,
          postId,
          replyId,
        },
        update: {},
      });

      const pushType =
        type === UserNotificationType.wall_reply_on_post
          ? NOTIFICATION_TYPES.WALL_REPLY_ON_POST
          : NOTIFICATION_TYPES.WALL_REPLY_ON_THREAD;

      const title =
        type === UserNotificationType.wall_reply_on_post
          ? 'Someone replied on your post'
          : 'New reply on a thread you joined';

      await this.notifications.sendToUser(recipientId, {
        type: pushType,
        title,
        body: replyPreview.slice(0, 80),
        data: {
          type: pushType,
          postId: String(postId),
          replyId: String(replyId),
        },
      });
    }
  }

  private activeWallPostFilter() {
    const cutoff = new Date(Date.now() - WALL_POST_MAX_AGE_HOURS * 60 * 60 * 1000);
    const now = new Date();

    return {
      post: {
        status: WallPostStatus.active,
        createdAt: { gte: cutoff },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    };
  }

  private async countIcebreakerUnread(userId: string) {
    const matches = await this.prisma.match.findMany({
      where: {
        status: MatchStatus.pending,
        source: MatchSource.icebreaker,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      select: {
        userAId: true,
        userBId: true,
        userAAcceptedAt: true,
        userBAcceptedAt: true,
      },
    });

    return matches.filter((match) => {
      const isUserA = match.userAId === userId;
      const myAccepted = isUserA ? match.userAAcceptedAt : match.userBAcceptedAt;
      const theirAccepted = isUserA ? match.userBAcceptedAt : match.userAAcceptedAt;
      return !myAccepted && !!theirAccepted;
    }).length;
  }
}
