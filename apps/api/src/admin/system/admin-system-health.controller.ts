import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminRole } from '@pingme/db';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AdminSystemHealthService } from './admin-system-health.service';

@Public()
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles(AdminRole.moderator, AdminRole.super_admin, AdminRole.support)
@Controller('admin/system')
export class AdminSystemHealthController {
  constructor(private readonly health: AdminSystemHealthService) {}

  @Get('health')
  getHealth() {
    return this.health.getHealth().then((data) => ({ success: true, data }));
  }
}
