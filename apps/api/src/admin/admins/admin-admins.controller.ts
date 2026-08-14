import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminRole } from '@pingme/db';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { AdminAuditService } from '../admin-audit.service';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AdminAdminsService } from './admin-admins.service';

class CreateAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(AdminRole)
  role!: AdminRole;
}

class UpdateAdminDto {
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

@Public()
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles(AdminRole.super_admin)
@Controller('admin/admins')
export class AdminAdminsController {
  constructor(
    private readonly admins: AdminAdminsService,
    private readonly adminAudit: AdminAuditService,
  ) {}

  @Get()
  list() {
    return this.admins.list();
  }

  @Post()
  async create(@Body() dto: CreateAdminDto, @CurrentAdmin() admin: { id: string }) {
    const created = await this.admins.create(dto);

    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'admin.create',
      entityType: 'admin_user',
      entityId: created.id,
      metadata: { email: created.email, role: created.role },
    });

    return created;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminDto,
    @CurrentAdmin() admin: { id: string },
  ) {
    const updated = await this.admins.update(id, dto);

    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'admin.update',
      entityType: 'admin_user',
      entityId: id,
      metadata: { role: dto.role },
    });

    return updated;
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: { id: string },
  ) {
    const result = await this.admins.remove(id, admin.id);

    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'admin.delete',
      entityType: 'admin_user',
      entityId: id,
    });

    return result;
  }
}
