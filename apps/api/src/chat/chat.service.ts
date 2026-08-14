import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ChatStatus, MatchStatus, MessageStatus } from '@pingme/db';
import { NOTIFICATION_TYPES } from '@pingme/shared';
import { AuditService } from '../audit/audit.service';
import { BlocksService } from '../common/services/blocks.service';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly blocks: BlocksService,
    private readonly notifications: NotificationService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly gateway: ChatGateway,
  ) {}

  async listChats(userId: string) {
    const blockedIds = await this.blocks.getBlockedUserIds(userId);

    const chats = await this.prisma.chat.findMany({
      where: {
        status: ChatStatus.active,
        match: {
          status: MatchStatus.active,
          OR: [{ userAId: userId }, { userBId: userId }],
        },
      },
      include: {
        match: {
          include: {
            userA: { include: { profile: true } },
            userB: { include: { profile: true } },
          },
        },
        messages: {
          where: { status: { not: MessageStatus.deleted } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const data = chats
      .map((chat) => {
        const otherUserId = chat.match.userAId === userId ? chat.match.userBId : chat.match.userAId;
        if (blockedIds.includes(otherUserId)) return null;

        const otherProfile =
          chat.match.userAId === userId ? chat.match.userB.profile : chat.match.userA.profile;
        const lastMessage = chat.messages[0] ?? null;

        return {
          id: chat.id,
          matchId: chat.matchId,
          status: chat.status,
          otherUser: {
            id: otherUserId,
            displayName: otherProfile?.displayName ?? 'User',
          },
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
                isYou: lastMessage.senderId === userId,
              }
            : null,
          createdAt: chat.createdAt,
          sortAt: lastMessage?.createdAt ?? chat.createdAt,
        };
      })
      .filter((chat): chat is NonNullable<typeof chat> => chat !== null)
      .sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime())
      .map(({ sortAt: _sortAt, ...chat }) => chat);

    return { success: true, data };
  }

  async getChat(userId: string, chatId: string) {
    const chat = await this.getChatForUser(userId, chatId);
    const otherUserId = chat.match.userAId === userId ? chat.match.userBId : chat.match.userAId;
    const otherProfile =
      chat.match.userAId === userId ? chat.match.userB.profile : chat.match.userA.profile;

    return {
      success: true,
      data: {
        id: chat.id,
        matchId: chat.matchId,
        status: chat.status,
        otherUser: {
          id: otherUserId,
          displayName: otherProfile?.displayName ?? 'User',
        },
        createdAt: chat.createdAt,
      },
    };
  }

  async listMessages(userId: string, chatId: string, page = 1, limit = 50) {
    await this.getChatForUser(userId, chatId);
    const offset = (page - 1) * limit;

    const messages = await this.prisma.message.findMany({
      where: {
        chatId,
        status: { not: MessageStatus.deleted },
      },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: limit,
    });

    return {
      success: true,
      data: messages.map((message) => ({
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        isYou: message.senderId === userId,
        status: message.status,
      })),
      meta: { page, limit },
    };
  }

  async sendMessage(userId: string, chatId: string, content: string) {
    const chat = await this.getChatForUser(userId, chatId);

    if (chat.status !== ChatStatus.active) {
      throw new BadRequestException('Chat is not active');
    }

    const otherUserId = chat.match.userAId === userId ? chat.match.userBId : chat.match.userAId;
    const blocked = await this.blocks.getBlockedUserIds(userId);
    if (blocked.includes(otherUserId)) {
      throw new ForbiddenException('Cannot message blocked user');
    }

    const message = await this.prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        content: content.trim(),
      },
    });

    await this.audit.log({
      userId,
      action: 'message.send',
      entityType: 'message',
      entityId: message.id,
      metadata: { chatId },
    });

    const recipientOnline = this.gateway.isUserOnline(otherUserId);
    if (!recipientOnline) {
      await this.notifications.sendToUser(otherUserId, {
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        title: 'New message',
        body: content.trim().slice(0, 100),
        data: {
          type: NOTIFICATION_TYPES.CHAT_MESSAGE,
          chatId,
          messageId: message.id,
        },
      });
    }

    const messagePayload = {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      isYou: false,
      status: message.status,
    };

    this.gateway.emitMessageNew(otherUserId, {
      chatId,
      message: messagePayload,
    });

    return {
      success: true,
      data: {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        isYou: true,
        status: message.status,
      },
    };
  }

  async closeChat(userId: string, chatId: string) {
    const chat = await this.getChatForUser(userId, chatId);

    const updated = await this.prisma.chat.update({
      where: { id: chat.id },
      data: { status: ChatStatus.closed },
    });

    await this.audit.log({
      userId,
      action: 'chat.close',
      entityType: 'chat',
      entityId: chatId,
    });

    return { success: true, data: { id: updated.id, status: updated.status } };
  }

  async markMessagesRead(userId: string, chatId: string, messageIds?: string[]) {
    await this.getChatForUser(userId, chatId);

    const where = {
      chatId,
      senderId: { not: userId },
      status: { not: MessageStatus.deleted },
      ...(messageIds?.length ? { id: { in: messageIds } } : {}),
    };

    const result = await this.prisma.message.updateMany({
      where,
      data: { status: MessageStatus.read },
    });

    const chat = await this.getChatForUser(userId, chatId);
    const otherUserId = chat.match.userAId === userId ? chat.match.userBId : chat.match.userAId;

    this.gateway.emitMessageRead(otherUserId, {
      chatId,
      messageIds: messageIds ?? [],
      readBy: userId,
      readCount: result.count,
    });

    return { updated: result.count };
  }

  private async getChatForUser(userId: string, chatId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        match: {
          include: {
            userA: { include: { profile: true } },
            userB: { include: { profile: true } },
          },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.match.userAId !== userId && chat.match.userBId !== userId) {
      throw new ForbiddenException('Not your chat');
    }

    return chat;
  }
}
