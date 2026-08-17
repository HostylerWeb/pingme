import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageStatus, Prisma, ReportReason, ReportStatus } from '@pingme/db';
import { buildReputationSummary } from '@pingme/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ReputationService } from '../../reputation/reputation.service';

@Injectable()
export class AdminReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reputation: ReputationService,
  ) {}

  async list(params: {
    status?: ReportStatus;
    reason?: ReportReason;
    assignedToAdminId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ReportWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.reason ? { reason: params.reason } : {}),
      ...(params.assignedToAdminId ? { assignedToAdminId: params.assignedToAdminId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: { include: { profile: { select: { displayName: true } } } },
          reportedUser: { include: { profile: { select: { displayName: true } } } },
          assignedTo: { select: { id: true, email: true } },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      items: items.map((report) => this.mapReport(report)),
      total,
      page,
      limit,
    };
  }

  async getById(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        reporter: { include: { profile: { select: { displayName: true, avatarUrl: true } } } },
        reportedUser: { include: { profile: { select: { displayName: true, avatarUrl: true } } } },
        assignedTo: { select: { id: true, email: true, role: true } },
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const target = await this.resolveTarget(report.targetType, report.targetId);
    const context = await this.buildModerationContext(report, target);

    return {
      report: this.mapReport(report),
      target,
      context,
    };
  }

  async assign(id: string, adminUserId: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return this.prisma.report.update({
      where: { id },
      data: {
        assignedToAdminId: adminUserId,
        status: report.status === 'open' ? 'reviewing' : report.status,
      },
      include: {
        assignedTo: { select: { id: true, email: true } },
      },
    });
  }

  async update(
    id: string,
    data: {
      status: ReportStatus;
      resolutionNote?: string;
      resolvedBy: string;
      reputationDeduction?: { targetUserId: string; amount: number };
    },
  ) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const isResolved = data.status === 'resolved' || data.status === 'dismissed';

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: data.status,
        resolutionNote: data.resolutionNote,
        resolvedBy: isResolved ? data.resolvedBy : null,
        resolvedAt: isResolved ? new Date() : null,
      },
    });

    if (isResolved && data.reputationDeduction && data.reputationDeduction.amount > 0) {
      const sourceType =
        data.status === 'resolved' ? 'report_deduction' : 'report_reporter_penalty';
      await this.reputation.applyAdminDeduction({
        userId: data.reputationDeduction.targetUserId,
        amount: data.reputationDeduction.amount,
        sourceType,
        sourceId: id,
        adminId: data.resolvedBy,
        note: data.resolutionNote,
      });
    }

    return updated;
  }

  async bulkAssign(ids: string[], adminUserId: string) {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) {
      return { updated: 0 };
    }

    const [openUpdated, reviewingUpdated] = await Promise.all([
      this.prisma.report.updateMany({
        where: { id: { in: uniqueIds }, status: 'open' },
        data: {
          assignedToAdminId: adminUserId,
          status: 'reviewing',
        },
      }),
      this.prisma.report.updateMany({
        where: { id: { in: uniqueIds }, status: 'reviewing' },
        data: { assignedToAdminId: adminUserId },
      }),
    ]);

    return { updated: openUpdated.count + reviewingUpdated.count };
  }

  async bulkUpdate(
    ids: string[],
    data: {
      status: ReportStatus;
      resolutionNote?: string;
      resolvedBy: string;
    },
  ) {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) {
      return { updated: 0 };
    }

    const isResolved = data.status === 'resolved' || data.status === 'dismissed';

    const result = await this.prisma.report.updateMany({
      where: { id: { in: uniqueIds } },
      data: {
        status: data.status,
        resolutionNote: data.resolutionNote,
        resolvedBy: isResolved ? data.resolvedBy : null,
        resolvedAt: isResolved ? new Date() : null,
      },
    });

    return { updated: result.count };
  }

  private mapReport(report: {
    id: string;
    targetType: string;
    targetId: string;
    reason: string;
    description: string | null;
    status: string;
    createdAt: Date;
    resolvedAt: Date | null;
    resolutionNote: string | null;
    reporterId: string;
    reportedUserId: string;
    assignedToAdminId: string | null;
    reporter: { profile: { displayName: string; avatarUrl?: string | null } | null };
    reportedUser: { profile: { displayName: string; avatarUrl?: string | null } | null };
    assignedTo?: { id: string; email: string } | null;
  }) {
    return {
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      description: report.description,
      status: report.status,
      createdAt: report.createdAt,
      resolvedAt: report.resolvedAt,
      resolutionNote: report.resolutionNote,
      reporter: {
        id: report.reporterId,
        displayName: report.reporter.profile?.displayName ?? null,
        avatarUrl: report.reporter.profile?.avatarUrl ?? null,
      },
      reportedUser: {
        id: report.reportedUserId,
        displayName: report.reportedUser.profile?.displayName ?? null,
        avatarUrl: report.reportedUser.profile?.avatarUrl ?? null,
      },
      assignedTo: report.assignedTo
        ? { id: report.assignedTo.id, email: report.assignedTo.email }
        : null,
    };
  }

  private async resolveTarget(targetType: string, targetId: string) {
    switch (targetType) {
      case 'post': {
        const post = await this.prisma.wallPost.findUnique({
          where: { id: targetId },
          include: {
            user: { include: { profile: { select: { displayName: true } } } },
          },
        });
        return post
          ? {
              type: 'post',
              id: post.id,
              content: post.content,
              status: post.status,
              createdAt: post.createdAt,
              authorDisplayName: post.user.profile?.displayName ?? null,
            }
          : null;
      }
      case 'reply': {
        const reply = await this.prisma.wallReply.findUnique({
          where: { id: targetId },
          include: {
            user: { include: { profile: { select: { displayName: true } } } },
            post: { select: { id: true, content: true } },
          },
        });
        return reply
          ? {
              type: 'reply',
              id: reply.id,
              content: reply.content,
              status: reply.status,
              postId: reply.postId,
              postContent: reply.post.content,
              createdAt: reply.createdAt,
              authorDisplayName: reply.user.profile?.displayName ?? null,
            }
          : null;
      }
      case 'message': {
        const message = await this.prisma.message.findUnique({
          where: { id: targetId },
          include: {
            sender: { include: { profile: { select: { displayName: true } } } },
            chat: { select: { id: true } },
          },
        });
        return message
          ? {
              type: 'message',
              id: message.id,
              content: message.content,
              status: message.status,
              chatId: message.chatId,
              createdAt: message.createdAt,
              authorDisplayName: message.sender.profile?.displayName ?? null,
            }
          : null;
      }
      case 'event': {
        const event = await this.prisma.event.findUnique({
          where: { id: targetId },
          include: {
            user: { include: { profile: { select: { displayName: true } } } },
          },
        });
        return event
          ? {
              type: 'event',
              id: event.id,
              content: event.title,
              status: event.status,
              createdAt: event.createdAt,
              authorDisplayName: event.user.profile?.displayName ?? null,
            }
          : null;
      }
      case 'event_comment': {
        const comment = await this.prisma.eventComment.findUnique({
          where: { id: targetId },
          include: {
            user: { include: { profile: { select: { displayName: true } } } },
            event: { select: { id: true, title: true } },
          },
        });
        return comment
          ? {
              type: 'event_comment',
              id: comment.id,
              content: comment.content,
              status: comment.status,
              eventId: comment.eventId,
              eventTitle: comment.event.title,
              createdAt: comment.createdAt,
              authorDisplayName: comment.user.profile?.displayName ?? null,
            }
          : null;
      }
      case 'user': {
        const user = await this.prisma.user.findUnique({
          where: { id: targetId },
          include: { profile: { select: { displayName: true, bio: true } } },
        });
        return user
          ? {
              type: 'user',
              id: user.id,
              displayName: user.profile?.displayName ?? null,
              bio: user.profile?.bio ?? null,
              status: user.status,
            }
          : null;
      }
      default:
        return null;
    }
  }

  private async buildModerationContext(
    report: {
      id: string;
      reporterId: string;
      reportedUserId: string;
      targetType: string;
      targetId: string;
      reason: string;
      description: string | null;
    },
    target: Awaited<ReturnType<AdminReportsService['resolveTarget']>>,
  ) {
    const [
      reportedUser,
      reporter,
      relatedReports,
      recentPosts,
      recentChats,
      reporterConversation,
      chatContext,
    ] = await Promise.all([
      this.getUserSummary(report.reportedUserId),
      this.getUserSummary(report.reporterId),
      this.prisma.report.findMany({
        where: {
          reportedUserId: report.reportedUserId,
          id: { not: report.id },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          reporter: { include: { profile: { select: { displayName: true } } } },
        },
      }),
      this.prisma.wallPost.findMany({
        where: { userId: report.reportedUserId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          content: true,
          status: true,
          createdAt: true,
        },
      }),
      this.getRecentChats(report.reportedUserId, 8),
      this.getConversationBetweenUsers(report.reporterId, report.reportedUserId),
      target?.type === 'message' && target.chatId
        ? this.getMessageChatContext(target.chatId, target.id)
        : Promise.resolve(null),
    ]);

    return {
      summary: this.buildSummary(report, target),
      reportedUser,
      reporter,
      relatedReports: relatedReports.map((item) => ({
        id: item.id,
        reason: item.reason,
        status: item.status,
        targetType: item.targetType,
        createdAt: item.createdAt,
        reporterDisplayName: item.reporter.profile?.displayName ?? null,
      })),
      recentPosts,
      recentChats,
      reporterConversation,
      chatContext,
    };
  }

  private buildSummary(
    report: { reason: string; targetType: string; description: string | null },
    target: Awaited<ReturnType<AdminReportsService['resolveTarget']>>,
  ) {
    const reasonLabel = report.reason.replace(/_/g, ' ');
    if (!target) {
      return `Reported for ${reasonLabel}. The original ${report.targetType} content is no longer available.`;
    }

    switch (target.type) {
      case 'message':
        return `Reported for ${reasonLabel}: a chat message${target.content ? ` — "${this.truncate(target.content, 120)}"` : ''}.`;
      case 'post':
        return `Reported for ${reasonLabel}: a wall post${target.content ? ` — "${this.truncate(target.content, 120)}"` : ''}.`;
      case 'reply':
        return `Reported for ${reasonLabel}: a wall reply${target.content ? ` — "${this.truncate(target.content, 120)}"` : ''}.`;
      case 'user':
        return `Reported for ${reasonLabel}: the user's profile${target.bio ? ` — bio: "${this.truncate(target.bio, 120)}"` : ''}.`;
      default:
        return `Reported for ${reasonLabel} (${report.targetType}).`;
    }
  }

  private truncate(value: string, max: number) {
    const trimmed = value.trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max - 1)}…`;
  }

  private async getUserSummary(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          select: {
            displayName: true,
            bio: true,
            avatarUrl: true,
            gender: true,
            dateOfBirth: true,
          },
        },
        _count: {
          select: {
            reportsReceived: true,
            reportsFiled: true,
            wallPosts: true,
            matchesAsUserA: true,
            matchesAsUserB: true,
          },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      status: user.status,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      reputationScore: user.reputationScore,
      reputation: buildReputationSummary(user.reputationScore),
      displayName: user.profile?.displayName ?? null,
      bio: user.profile?.bio ?? null,
      avatarUrl: user.profile?.avatarUrl ?? null,
      gender: user.profile?.gender ?? null,
      dateOfBirth: user.profile?.dateOfBirth ?? null,
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt,
      counts: {
        reportsReceived: user._count.reportsReceived,
        reportsFiled: user._count.reportsFiled,
        wallPosts: user._count.wallPosts,
        matches: user._count.matchesAsUserA + user._count.matchesAsUserB,
      },
    };
  }

  private async getRecentChats(userId: string, limit: number) {
    const matches = await this.prisma.match.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        chat: { isNot: null },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        chat: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            messages: {
              where: { status: { not: MessageStatus.deleted } },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { content: true, createdAt: true },
            },
          },
        },
        userA: { include: { profile: { select: { displayName: true } } } },
        userB: { include: { profile: { select: { displayName: true } } } },
      },
    });

    return matches.map((match) => {
      const otherUser =
        match.userAId === userId
          ? {
              id: match.userBId,
              displayName: match.userB.profile?.displayName ?? null,
            }
          : {
              id: match.userAId,
              displayName: match.userA.profile?.displayName ?? null,
            };
      const lastMessage = match.chat?.messages[0] ?? null;

      return {
        chatId: match.chat?.id ?? null,
        matchId: match.id,
        matchStatus: match.status,
        chatStatus: match.chat?.status ?? null,
        otherUser,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              createdAt: lastMessage.createdAt,
            }
          : null,
        createdAt: match.createdAt,
      };
    });
  }

  private async getConversationBetweenUsers(userAId: string, userBId: string) {
    const match = await this.prisma.match.findFirst({
      where: {
        OR: [
          { userAId, userBId },
          { userAId: userBId, userBId: userAId },
        ],
        chat: { isNot: null },
      },
      include: {
        chat: { select: { id: true, status: true } },
      },
    });

    if (!match?.chat) {
      return null;
    }

    const messages = await this.prisma.message.findMany({
      where: {
        chatId: match.chat.id,
        status: { not: MessageStatus.deleted },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: {
        sender: { include: { profile: { select: { displayName: true } } } },
      },
    });

    return {
      chatId: match.chat.id,
      matchId: match.id,
      matchStatus: match.status,
      chatStatus: match.chat.status,
      messages: messages.reverse().map((message) => ({
        id: message.id,
        content: message.content,
        status: message.status,
        createdAt: message.createdAt,
        sender: {
          id: message.senderId,
          displayName: message.sender.profile?.displayName ?? null,
        },
      })),
    };
  }

  private async getMessageChatContext(chatId: string, highlightedMessageId: string) {
    const highlighted = await this.prisma.message.findUnique({
      where: { id: highlightedMessageId },
      include: {
        sender: { include: { profile: { select: { displayName: true } } } },
      },
    });

    if (!highlighted || highlighted.chatId !== chatId) {
      return null;
    }

    const [before, after] = await Promise.all([
      this.prisma.message.findMany({
        where: {
          chatId,
          createdAt: { lt: highlighted.createdAt },
          status: { not: MessageStatus.deleted },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          sender: { include: { profile: { select: { displayName: true } } } },
        },
      }),
      this.prisma.message.findMany({
        where: {
          chatId,
          createdAt: { gt: highlighted.createdAt },
          status: { not: MessageStatus.deleted },
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
        include: {
          sender: { include: { profile: { select: { displayName: true } } } },
        },
      }),
    ]);

    const mapMessage = (message: (typeof before)[number]) => ({
      id: message.id,
      content: message.content,
      status: message.status,
      createdAt: message.createdAt,
      sender: {
        id: message.senderId,
        displayName: message.sender.profile?.displayName ?? null,
      },
    });

    return {
      chatId,
      highlightedMessageId,
      messages: [
        ...before.reverse().map(mapMessage),
        {
          id: highlighted.id,
          content: highlighted.content,
          status: highlighted.status,
          createdAt: highlighted.createdAt,
          sender: {
            id: highlighted.senderId,
            displayName: highlighted.sender.profile?.displayName ?? null,
          },
        },
        ...after.map(mapMessage),
      ],
    };
  }
}
