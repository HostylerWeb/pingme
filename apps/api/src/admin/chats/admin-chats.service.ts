import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminChatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMessages(chatId: string, page = 1, limit = 50) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * safeLimit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { chatId },
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'asc' },
        include: {
          sender: { include: { profile: { select: { displayName: true } } } },
        },
      }),
      this.prisma.message.count({ where: { chatId } }),
    ]);

    return {
      chatId,
      messages: messages.map((message) => ({
        id: message.id,
        content: message.content,
        messageType: message.messageType,
        status: message.status,
        createdAt: message.createdAt,
        sender: {
          id: message.senderId,
          displayName: message.sender.profile?.displayName ?? null,
        },
      })),
      total,
      page,
      limit: safeLimit,
    };
  }
}
