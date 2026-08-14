import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminRole } from '@pingme/db';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AdminMapService } from './admin-map.service';

@Public()
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.moderator)
@Controller('admin/map')
export class AdminMapController {
  constructor(private readonly mapService: AdminMapService) {}

  @Get('heatmap')
  getHeatmap() {
    return this.mapService.getHeatmap();
  }
}
