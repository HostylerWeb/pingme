import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportReason, ReportStatus } from '@pingme/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminReportsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      report: this.mapReport(report),
      target,
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
    },
  ) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const isResolved = data.status === 'resolved' || data.status === 'dismissed';

    return this.prisma.report.update({
      where: { id },
      data: {
        status: data.status,
        resolutionNote: data.resolutionNote,
        resolvedBy: isResolved ? data.resolvedBy : null,
        resolvedAt: isResolved ? new Date() : null,
      },
    });
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
    reporter: { profile: { displayName: string } | null };
    reportedUser: { profile: { displayName: string } | null };
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
      },
      reportedUser: {
        id: report.reportedUserId,
        displayName: report.reportedUser.profile?.displayName ?? null,
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
}
