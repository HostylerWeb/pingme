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
import { getPublicProfileFields, loadLivenessVerifiedSet } from '../common/utils/public-profile.util';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly blocks: BlocksService,
    private readonly notifications: NotificationService,
    private readonly subscriptions: SubscriptionsService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly gateway: ChatGateway,
  ) {}

  async listChats(userId: string, cursor?: string, limitInput?: number) {
    const limit = Math.min(Math.max(limitInput ?? 20, 1), 50);
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
            userA: { include: { profile: true, subscription: true } },
            userB: { include: { profile: true, subscription: true } },
          },
        },
        messages: {
          where: { status: { not: MessageStatus.deleted } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const chatIds = chats.map((chat) => chat.id);
    const unreadCounts =
      chatIds.length > 0
        ? await this.prisma.message.groupBy({
            by: ['chatId'],
            where: {
              chatId: { in: chatIds },
              senderId: { not: userId },
              status: { notIn: [MessageStatus.deleted, MessageStatus.read] },
            },
            _count: { _all: true },
          })
        : [];
    const unreadByChatId = new Map(
      unreadCounts.map((row) => [row.chatId, row._count._all]),
    );

    const otherUserIds = chats.map((chat) =>
      chat.match.userAId === userId ? chat.match.userBId : chat.match.userAId,
    );
    const verifiedSet = await loadLivenessVerifiedSet(this.prisma, otherUserIds);

    const cursorPayload = decodeChatCursor(cursor);

    const ranked = chats
      .map((chat) => {
        const otherUserId = chat.match.userAId === userId ? chat.match.userBId : chat.match.userAId;
        if (blockedIds.includes(otherUserId)) return null;

        const otherUser =
          chat.match.userAId === userId ? chat.match.userB : chat.match.userA;
        const otherProfile = otherUser.profile;
        const flair = getPublicProfileFields(
          otherProfile,
          otherUser.subscription,
          verifiedSet.has(otherUserId),
        );
        const lastMessage = chat.messages[0] ?? null;
        const sortAt = lastMessage?.createdAt ?? chat.createdAt;

        return {
          id: chat.id,
          matchId: chat.matchId,
          status: chat.status,
          otherUser: {
            id: otherUserId,
            displayName: otherProfile?.displayName ?? 'User',
            avatarUrl: otherProfile?.avatarUrl ?? null,
            isPremium: flair.isPremium,
            avatarTheme: flair.avatarTheme,
            livenessVerified: flair.livenessVerified,
          },
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
                isYou: lastMessage.senderId === userId,
              }
            : null,
          unreadCount: unreadByChatId.get(chat.id) ?? 0,
          createdAt: chat.createdAt,
          sortAt,
        };
      })
      .filter((chat): chat is NonNullable<typeof chat> => chat !== null)
      .sort((a, b) => {
        const byTime = b.sortAt.getTime() - a.sortAt.getTime();
        if (byTime !== 0) return byTime;
        return b.id.localeCompare(a.id);
      })
      .filter((chat) => {
        if (!cursorPayload) return true;
        if (chat.sortAt.getTime() < cursorPayload.sortAt) return true;
        if (chat.sortAt.getTime() > cursorPayload.sortAt) return false;
        return chat.id < cursorPayload.id;
      });

    const page = ranked.slice(0, limit + 1);
    const hasMore = page.length > limit;
    const items = hasMore ? page.slice(0, limit) : page;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeChatCursor({ sortAt: last.sortAt.getTime(), id: last.id })
        : null;

    const data = items.map(({ sortAt: _sortAt, ...chat }) => chat);

    return {
      success: true,
      data,
      meta: { limit, nextCursor, hasMore },
    };
  }

  async getChat(userId: string, chatId: string) {
    const chat = await this.getChatForUser(userId, chatId);
    const otherUserId = chat.match.userAId === userId ? chat.match.userBId : chat.match.userAId;
    const otherUser =
      chat.match.userAId === userId ? chat.match.userB : chat.match.userA;
    const flair = getPublicProfileFields(
      otherUser.profile,
      otherUser.subscription,
      (await loadLivenessVerifiedSet(this.prisma, [otherUserId])).has(otherUserId),
    );

    return {
      success: true,
      data: {
        id: chat.id,
        matchId: chat.matchId,
        status: chat.status,
        otherUser: {
          id: otherUserId,
          displayName: otherUser.profile?.displayName ?? 'User',
          avatarUrl: otherUser.profile?.avatarUrl ?? null,
          isPremium: flair.isPremium,
          avatarTheme: flair.avatarTheme,
          livenessVerified: flair.livenessVerified,
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

    const showReadReceipts = await this.subscriptions.canShowReadReceipts(userId);

    return {
      success: true,
      data: messages.map((message) => ({
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        isYou: message.senderId === userId,
        status: message.status,
        ...(showReadReceipts && message.senderId === userId
          ? { read: message.status === MessageStatus.read }
          : {}),
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

    const recipientOnline = await this.gateway.isUserOnline(otherUserId);
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

    const senderIds = await this.prisma.message.findMany({
      where,
      select: { senderId: true },
      distinct: ['senderId'],
    });

    const sendersWithReceipts = new Set<string>();
    for (const { senderId } of senderIds) {
      if (await this.subscriptions.canShowReadReceipts(senderId)) {
        sendersWithReceipts.add(senderId);
      }
    }

    if (sendersWithReceipts.size > 0) {
      this.gateway.emitMessageRead(otherUserId, {
        chatId,
        messageIds: messageIds ?? [],
        readBy: userId,
        readCount: result.count,
      });
    }

    return { updated: result.count };
  }

  private async getChatForUser(userId: string, chatId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        match: {
          include: {
            userA: { include: { profile: true, subscription: true } },
            userB: { include: { profile: true, subscription: true } },
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

function encodeChatCursor(payload: { sortAt: number; id: string }): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeChatCursor(cursor?: string): { sortAt: number; id: string } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      sortAt?: unknown;
      id?: unknown;
    };
    if (typeof parsed.sortAt !== 'number' || typeof parsed.id !== 'string') {
      return null;
    }
    return { sortAt: parsed.sortAt, id: parsed.id };
  } catch {
    return null;
  }
}
