import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { MatchSource, MatchStatus } from '@pingme/db';
import { MATCH_EXPIRY_MINUTES, MatchRequestInput, NOTIFICATION_TYPES } from '@pingme/shared';
import { AuditService } from '../audit/audit.service';
import { ChatGateway } from '../chat/chat.gateway';
import { BlocksService } from '../common/services/blocks.service';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { activateMatchIfReady, resetIcebreakerSessionsForMatch } from './match.utils';

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly blocks: BlocksService,
    private readonly notifications: NotificationService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly gateway: ChatGateway,
  ) {}

  async list(userId: string) {
    const matches = await this.prisma.match.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        status: { in: [MatchStatus.pending, MatchStatus.active] },
      },
      include: { chat: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: matches.map((match) => this.serializeMatch(match, userId)),
    };
  }

  async getById(userId: string, matchId: string) {
    const match = await this.getMatchForUser(userId, matchId, true);
    return { success: true, data: this.serializeMatch(match, userId, true) };
  }

  async accept(userId: string, matchId: string) {
    const match = await this.getMatchForUser(userId, matchId);

    if (match.status !== MatchStatus.pending) {
      throw new BadRequestException('Match is not pending');
    }

    const isUserA = match.userAId === userId;
    const alreadyAccepted = isUserA ? match.userAAcceptedAt : match.userBAcceptedAt;
    if (alreadyAccepted) {
      return { success: true, data: this.serializeMatch(match, userId, true) };
    }

    const now = new Date();
    const updateData = isUserA
      ? { userAAcceptedAt: now }
      : { userBAcceptedAt: now };

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: updateData,
      include: { chat: { select: { id: true } } },
    });

    const otherAccepted = isUserA ? updated.userBAcceptedAt : updated.userAAcceptedAt;
    const otherUserId = isUserA ? updated.userBId : updated.userAId;

    if (otherAccepted) {
      const activated = await this.prisma.$transaction(async (tx) => {
        return activateMatchIfReady(tx, matchId);
      });

      if (!activated) {
        throw new NotFoundException('Match not found');
      }

      await this.audit.log({
        userId,
        action: 'match.accept',
        entityType: 'match',
        entityId: matchId,
        metadata: { bothAccepted: true },
      });

      await this.notifications.sendToUser(otherUserId, {
        type: NOTIFICATION_TYPES.MATCH_REQUEST,
        title: "You're connected!",
        body: 'Open PingMe to start chatting.',
        data: {
          type: NOTIFICATION_TYPES.MATCH_REQUEST,
          matchId,
          ...(activated.chat?.id ? { chatId: activated.chat.id } : {}),
        },
      });

      this.emitMatchUpdate(userId, activated);
      this.emitMatchUpdate(otherUserId, activated);

      return { success: true, data: this.serializeMatch(activated, userId, true) };
    }

    await this.notifications.sendToUser(otherUserId, {
      type: NOTIFICATION_TYPES.MATCH_REQUEST,
      title: 'Someone accepted your match',
      body: 'Open PingMe to accept and start chatting.',
      data: { type: NOTIFICATION_TYPES.MATCH_REQUEST, matchId },
    });

    await this.audit.log({
      userId,
      action: 'match.accept',
      entityType: 'match',
      entityId: matchId,
    });

    this.emitMatchUpdate(userId, updated);
    this.emitMatchUpdate(otherUserId, updated);

    return { success: true, data: this.serializeMatch(updated, userId, true) };
  }

  async decline(userId: string, matchId: string) {
    const match = await this.getMatchForUser(userId, matchId);

    if (match.status !== MatchStatus.pending) {
      throw new BadRequestException('Match is not pending');
    }

    const declined = await this.prisma.$transaction(async (tx) => {
      const result = await tx.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.declined },
      });
      await resetIcebreakerSessionsForMatch(tx, match.source, match.sourceReferenceId);
      return result;
    });

    await this.audit.log({
      userId,
      action: 'match.decline',
      entityType: 'match',
      entityId: matchId,
    });

    return { success: true, data: this.serializeMatch(declined, userId, true) };
  }

  async request(userId: string, dto: MatchRequestInput) {
    if (dto.source !== 'wall_reply') {
      throw new BadRequestException('Only wall_reply source is supported');
    }

    const reply = await this.prisma.wallReply.findUnique({
      where: { id: dto.sourceReferenceId },
      include: { post: true },
    });
    if (!reply) {
      throw new NotFoundException('Reply not found');
    }

    const postAuthorId = reply.post.userId;
    const replierId = reply.userId;

    if (userId !== postAuthorId && userId !== replierId) {
      throw new ForbiddenException('You are not part of this conversation');
    }

    const otherUserId = userId === postAuthorId ? replierId : postAuthorId;
    const blocked = await this.blocks.getBlockedUserIds(userId);
    if (blocked.includes(otherUserId)) {
      throw new BadRequestException('Cannot match with blocked user');
    }

    const [userAId, userBId] = orderUserIds(userId, otherUserId);

    const existing = await this.prisma.match.findFirst({
      where: {
        userAId,
        userBId,
        source: MatchSource.wall_reply,
        sourceReferenceId: reply.id,
        status: { in: [MatchStatus.pending, MatchStatus.active] },
      },
    });
    if (existing) {
      return { success: true, data: this.serializeMatch(existing, userId, true) };
    }

    const expiresAt = new Date(Date.now() + MATCH_EXPIRY_MINUTES * 60 * 1000);
    const match = await this.prisma.match.create({
      data: {
        userAId,
        userBId,
        source: MatchSource.wall_reply,
        sourceReferenceId: reply.id,
        expiresAt,
        userAAcceptedAt: userId === userAId ? new Date() : undefined,
        userBAcceptedAt: userId === userBId ? new Date() : undefined,
      },
    });

    await this.audit.log({
      userId,
      action: 'match.request',
      entityType: 'match',
      entityId: match.id,
      metadata: { source: dto.source, sourceReferenceId: dto.sourceReferenceId },
    });

    if (userId === userAId ? match.userBAcceptedAt : match.userAAcceptedAt) {
      const activated = await this.prisma.$transaction(async (tx) => {
        return activateMatchIfReady(tx, match.id);
      });
      if (!activated) {
        throw new NotFoundException('Match not found');
      }
      return { success: true, data: this.serializeMatch(activated, userId, true) };
    }

    await this.notifications.sendToUser(otherUserId, {
      type: NOTIFICATION_TYPES.MATCH_REQUEST,
      title: 'Someone wants to chat',
      body: 'They replied on the wall — open PingMe to accept.',
      data: { type: NOTIFICATION_TYPES.MATCH_REQUEST, matchId: match.id },
    });

    return { success: true, data: this.serializeMatch(match, userId, true) };
  }

  async expirePendingMatches() {
    const result = await this.prisma.match.updateMany({
      where: {
        status: MatchStatus.pending,
        expiresAt: { lt: new Date() },
      },
      data: { status: MatchStatus.expired },
    });
    return result.count;
  }

  private async getMatchForUser(userId: string, matchId: string, withChat = false) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: withChat ? { chat: { select: { id: true } } } : undefined,
    });
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    if (match.userAId !== userId && match.userBId !== userId) {
      throw new ForbiddenException('Not your match');
    }
    return match;
  }

  private emitMatchUpdate(
    userId: string,
    match: { id: string; status: MatchStatus; chat?: { id: string } | null },
  ) {
    this.gateway.emitMatchUpdated(userId, {
      matchId: match.id,
      status: match.status,
      chatId: match.chat?.id ?? null,
    });
  }

  private serializeMatch(
    match: {
      id: string;
      userAId: string;
      userBId: string;
      source: MatchSource;
      status: MatchStatus;
      userAAcceptedAt: Date | null;
      userBAcceptedAt: Date | null;
      expiresAt: Date;
      createdAt: Date;
      chat?: { id: string } | null;
    },
    userId: string,
    includeAcceptance = false,
  ) {
    const isUserA = match.userAId === userId;
    const myAccepted = isUserA ? match.userAAcceptedAt : match.userBAcceptedAt;
    const theirAccepted = isUserA ? match.userBAcceptedAt : match.userAAcceptedAt;
    const isActive = match.status === MatchStatus.active;

    return {
      id: match.id,
      source: match.source,
      status: match.status,
      expiresAt: match.expiresAt,
      createdAt: match.createdAt,
      chatId: match.chat?.id ?? null,
      myAccepted: !!myAccepted,
      theirAccepted: !!theirAccepted,
      otherUser: isActive
        ? { anonymous: false, label: 'Connected' }
        : { anonymous: true, label: 'Someone nearby' },
      ...(includeAcceptance
        ? {
            youAccepted: !!myAccepted,
            theyAccepted: !!theirAccepted,
          }
        : {}),
    };
  }
}

function orderUserIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
