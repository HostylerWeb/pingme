import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminRole, EventStatus } from '@pingme/db';
import { Public } from '../../common/decorators/public.decorator';
import { AdminAuditService } from '../admin-audit.service';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AdminEventsService } from './admin-events.service';

@Public()
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles(AdminRole.moderator, AdminRole.super_admin)
@Controller('admin/events')
export class AdminEventsController {
  constructor(
    private readonly events: AdminEventsService,
    private readonly adminAudit: AdminAuditService,
  ) {}

  @Get()
  listEvents(
    @Query('status') status?: EventStatus,
    @Query('lifecycle') lifecycle?: 'ended' | 'upcoming',
    @Query('q') q?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.events.listEvents({
      status,
      lifecycle,
      q,
      userId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id/withdrawals')
  listWithdrawals(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.listWithdrawals(id);
  }

  @Patch(':id/hide')
  async hideEvent(
    @CurrentAdmin() admin: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const event = await this.events.hideEvent(id);
    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'event.hide',
      entityType: 'event',
      entityId: id,
    });
    return { success: true, data: event };
  }

  @Patch(':id/restore')
  async restoreEvent(
    @CurrentAdmin() admin: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const event = await this.events.restoreEvent(id);
    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'event.restore',
      entityType: 'event',
      entityId: id,
    });
    return { success: true, data: event };
  }

  @Delete(':id')
  async deleteEvent(
    @CurrentAdmin() admin: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const event = await this.events.deleteEvent(id);
    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'event.delete',
      entityType: 'event',
      entityId: id,
    });
    return { success: true, data: event };
  }
}
