import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserStatus } from '@pingme/db';
import { CreateReportInput } from '@pingme/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(reporterId: string, dto: CreateReportInput) {
    if (reporterId === dto.reportedUserId) {
      throw new BadRequestException('Cannot report yourself');
    }

    const reportedUser = await this.prisma.user.findUnique({
      where: { id: dto.reportedUserId },
    });
    if (!reportedUser) {
      throw new NotFoundException('Reported user not found');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        reportedUserId: dto.reportedUserId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        description: dto.description,
      },
    });

    await this.audit.log({
      userId: reporterId,
      action: 'report.create',
      entityType: 'report',
      entityId: report.id,
      metadata: { targetType: dto.targetType, targetId: dto.targetId },
    });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await this.prisma.report.count({
      where: {
        reportedUserId: dto.reportedUserId,
        createdAt: { gte: since },
      },
    });

    if (recentCount >= 3) {
      await this.prisma.user.update({
        where: { id: dto.reportedUserId },
        data: { status: UserStatus.suspended },
      });
      await this.audit.log({
        userId: reporterId,
        action: 'user.auto_suspend',
        entityType: 'user',
        entityId: dto.reportedUserId,
        metadata: { reportCount: recentCount },
      });
    }

    return { success: true, data: report };
  }
}
