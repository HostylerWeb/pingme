import { Injectable } from '@nestjs/common';
import { NOTIFICATION_TYPES } from '@pingme/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationQueueService } from './notification-queue.service';

export interface PushPayload {
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: NotificationQueueService,
  ) {}

  async sendToUser(userId: string, payload: PushPayload) {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (settings?.quietMode && payload.type !== NOTIFICATION_TYPES.MODERATION_ACTION) {
      return;
    }

    if (payload.type === NOTIFICATION_TYPES.WALL_REPLY && settings?.allowPushReplies === false) {
      return;
    }

    if (payload.type === NOTIFICATION_TYPES.CHAT_MESSAGE && settings?.allowPushChat === false) {
      return;
    }

    if (
      payload.type === NOTIFICATION_TYPES.ICEBREAKER_MATCH ||
      payload.type === NOTIFICATION_TYPES.MATCH_REQUEST
    ) {
      if (settings?.allowPushIcebreaker === false) return;
    }

    await this.queue.enqueuePush({ userId, ...payload });
  }
}
