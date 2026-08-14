import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminRole, ReportReason, ReportStatus } from '@pingme/db';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { AdminAuditService } from '../admin-audit.service';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AdminReportsService } from './admin-reports.service';

class UpdateReportDto {
  @IsEnum(ReportStatus)
  status!: ReportStatus;

  @IsOptional()
  @IsString()
  resolutionNote?: string;
}

@Public()
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles(AdminRole.moderator, AdminRole.super_admin)
@Controller('admin/reports')
export class AdminReportsController {
  constructor(
    private readonly reports: AdminReportsService,
    private readonly adminAudit: AdminAuditService,
  ) {}

  @Get()
  list(
    @Query('status') status?: ReportStatus,
    @Query('reason') reason?: ReportReason,
    @Query('assignedTo') assignedTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reports.list({
      status,
      reason,
      assignedToAdminId: assignedTo,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('export')
  async exportCsv(@Query('status') status?: ReportStatus, @Res() res?: Response) {
    const data = await this.reports.list({
      status,
      page: 1,
      limit: 1000,
    });

    const header = 'id,reason,status,targetType,createdAt,reporter,reportedUser\n';
    const rows = data.items
      .map(
        (r) =>
          `${r.id},${r.reason},${r.status},${r.targetType},${r.createdAt},${r.reporter.displayName ?? ''},${r.reportedUser.displayName ?? ''}`,
      )
      .join('\n');

    res!.setHeader('Content-Type', 'text/csv');
    res!.setHeader('Content-Disposition', 'attachment; filename=reports.csv');
    res!.send(header + rows);
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.reports.getById(id);
  }

  @Post(':id/assign')
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: { id: string },
  ) {
    const report = await this.reports.assign(id, admin.id);

    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'report.assign',
      entityType: 'report',
      entityId: id,
    });

    return report;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportDto,
    @CurrentAdmin() admin: { id: string },
  ) {
    const report = await this.reports.update(id, {
      status: dto.status,
      resolutionNote: dto.resolutionNote,
      resolvedBy: admin.id,
    });

    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'report.update',
      entityType: 'report',
      entityId: id,
      metadata: { status: dto.status, resolutionNote: dto.resolutionNote },
    });

    return report;
  }
}
