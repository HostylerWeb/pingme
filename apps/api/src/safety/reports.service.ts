import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateReportInput, REPORT_AUTO_FLAG_THRESHOLD, REPORT_AUTO_FLAG_WINDOW_HOURS } from '@pingme/shared';
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

    const existing = await this.prisma.report.findUnique({
      where: {
        reporterId_reportedUserId: {
          reporterId,
          reportedUserId: dto.reportedUserId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('You have already reported this person');
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

    await this.autoFlagReportedUser(dto.reportedUserId, dto.reason);

    return { success: true, data: report };
  }

  private async autoFlagReportedUser(reportedUserId: string, reason: string) {
    const since = new Date(Date.now() - REPORT_AUTO_FLAG_WINDOW_HOURS * 60 * 60 * 1000);
    const recentCount = await this.prisma.report.count({
      where: {
        reportedUserId,
        createdAt: { gte: since },
      },
    });

    const shouldFlag =
      reason === 'underage' || recentCount >= REPORT_AUTO_FLAG_THRESHOLD;

    if (!shouldFlag) {
      return;
    }

    await this.prisma.user.update({
      where: { id: reportedUserId },
      data: { requiresAdminReview: true },
    });

    await this.audit.log({
      userId: reportedUserId,
      action: 'user.auto_flagged_reports',
      entityType: 'user',
      entityId: reportedUserId,
      metadata: { recentCount, reason, windowHours: REPORT_AUTO_FLAG_WINDOW_HOURS },
    });
  }
}
