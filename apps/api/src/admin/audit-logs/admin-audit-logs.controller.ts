import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminRole } from '@pingme/db';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AdminAuditLogsService } from './admin-audit-logs.service';

@Public()
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.moderator)
@Controller('admin/audit-logs')
export class AdminAuditLogsController {
  constructor(private readonly auditLogs: AdminAuditLogsService) {}

  @Get('admin')
  searchAdmin(
    @Query('action') action?: string,
    @Query('adminUserId') adminUserId?: string,
    @Query('entityType') entityType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.auditLogs.searchAdmin({
      action,
      adminUserId,
      entityType,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('user')
  searchUser(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.auditLogs.searchUser({
      userId,
      action,
      entityType,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get()
  @Roles(AdminRole.super_admin)
  search(
    @Query('action') action?: string,
    @Query('adminUserId') adminUserId?: string,
    @Query('entityType') entityType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.auditLogs.searchAdmin({
      action,
      adminUserId,
      entityType,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
