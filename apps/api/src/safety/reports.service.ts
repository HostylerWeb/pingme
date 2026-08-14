import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

    return { success: true, data: report };
  }
}
