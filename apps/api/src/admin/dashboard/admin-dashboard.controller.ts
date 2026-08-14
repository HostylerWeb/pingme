import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminRole } from '@pingme/db';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@Public()
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles(AdminRole.moderator, AdminRole.super_admin, AdminRole.support)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get('stats')
  getStats() {
    return this.dashboard.getStats();
  }
}
