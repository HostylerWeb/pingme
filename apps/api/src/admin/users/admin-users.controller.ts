import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AdminRole,
  Prisma,
  UserStatus,
  VerificationStatus,
} from '@pingme/db';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { AdminAuditService } from '../admin-audit.service';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AdminUsersService } from './admin-users.service';

class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  displayName?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(5000)
  radiusMeters?: number;

  @IsOptional()
  @IsBoolean()
  quietMode?: boolean;
}

class UpdateVerificationFlagsDto {
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  phoneVerified?: boolean;
}

class SetLivenessStatusDto {
  @IsEnum(VerificationStatus)
  status!: VerificationStatus;
}

@Public()
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly adminAudit: AdminAuditService,
  ) {}

  @Get()
  @Roles(AdminRole.support, AdminRole.moderator, AdminRole.super_admin)
  list(
    @Query('q') q?: string,
    @Query('status') status?: UserStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.users.list({
      q,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id/posts')
  @Roles(AdminRole.support, AdminRole.moderator, AdminRole.super_admin)
  getPosts(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.users.getPosts(id, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get(':id/reports')
  @Roles(AdminRole.support, AdminRole.moderator, AdminRole.super_admin)
  getReports(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.users.getReportsReceived(id, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get(':id/chats')
  @Roles(AdminRole.support, AdminRole.moderator, AdminRole.super_admin)
  getChats(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.users.getChats(id, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get(':id/devices')
  @Roles(AdminRole.support, AdminRole.moderator, AdminRole.super_admin)
  getDevices(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.getDevices(id);
  }

  @Get(':id/devices/:deviceId')
  @Roles(AdminRole.support, AdminRole.moderator, AdminRole.super_admin)
  getDeviceForensics(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.users.getDeviceForensics(id, deviceId);
  }

  @Get(':id/blocks')
  @Roles(AdminRole.support, AdminRole.moderator, AdminRole.super_admin)
  getBlocks(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.getBlocks(id);
  }

  @Get(':id/matches')
  @Roles(AdminRole.support, AdminRole.moderator, AdminRole.super_admin)
  getMatches(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.users.getMatches(id, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get(':id/security-events')
  @Roles(AdminRole.support, AdminRole.moderator, AdminRole.super_admin)
  getSecurityEvents(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.users.getSecurityEvents(id, page ? Number(page) : 1, limit ? Number(limit) : 50);
  }

  @Get(':id/audit-logs')
  @Roles(AdminRole.support, AdminRole.moderator, AdminRole.super_admin)
  getAuditLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.users.getUserAuditLogs(id, page ? Number(page) : 1, limit ? Number(limit) : 50);
  }

  @Get(':id')
  @Roles(AdminRole.support, AdminRole.moderator, AdminRole.super_admin)
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.users.getById(id);
  }

  @Patch(':id')
  @Roles(AdminRole.moderator, AdminRole.super_admin)
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentAdmin() admin: { id: string },
  ): Promise<unknown> {
    const user = await this.users.updateUser(id, dto);

    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'user.update',
      entityType: 'user',
      entityId: id,
      metadata: dto as Prisma.InputJsonValue,
    });

    return user;
  }

  @Patch(':id/verification-flags')
  @Roles(AdminRole.moderator, AdminRole.super_admin)
  async updateVerificationFlags(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVerificationFlagsDto,
    @CurrentAdmin() admin: { id: string },
  ) {
    const result = await this.users.updateVerificationFlags(id, dto);

    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'user.verification_flags',
      entityType: 'user',
      entityId: id,
      metadata: dto as Prisma.InputJsonValue,
    });

    return result;
  }

  @Post(':id/verification/resend-email')
  @Roles(AdminRole.support, AdminRole.moderator, AdminRole.super_admin)
  async resendEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: { id: string },
  ) {
    const result = await this.users.resendEmailVerification(id);

    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'user.resend_email_verification',
      entityType: 'user',
      entityId: id,
    });

    return result;
  }

  @Post(':id/verification/resend-phone')
  @Roles(AdminRole.support, AdminRole.moderator, AdminRole.super_admin)
  async resendPhone(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: { id: string },
  ) {
    const result = await this.users.resendPhoneVerification(id);

    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'user.resend_phone_verification',
      entityType: 'user',
      entityId: id,
    });

    return result;
  }

  @Post(':id/verification/reset-liveness')
  @Roles(AdminRole.moderator, AdminRole.super_admin)
  async resetLiveness(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: { id: string },
  ) {
    const result = await this.users.resetLiveness(id);

    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'user.reset_liveness',
      entityType: 'user',
      entityId: id,
    });

    return result;
  }

  @Post(':id/verification/start-kyc')
  @Roles(AdminRole.moderator, AdminRole.super_admin)
  async startKyc(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: { id: string },
  ) {
    const result = await this.users.startKyc(id);

    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'user.start_kyc',
      entityType: 'user',
      entityId: id,
      metadata: { sessionId: result.data.sessionId },
    });

    return result;
  }

  @Post(':id/verification/clear-review')
  @Roles(AdminRole.moderator, AdminRole.super_admin)
  async clearReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: { id: string },
  ) {
    const result = await this.users.clearAdminReview(id);

    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'user.clear_admin_review',
      entityType: 'user',
      entityId: id,
    });

    return result;
  }

  @Patch(':id/verification/liveness')
  @Roles(AdminRole.moderator, AdminRole.super_admin)
  async setLivenessStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetLivenessStatusDto,
    @CurrentAdmin() admin: { id: string },
  ): Promise<unknown> {
    const result = await this.users.setLivenessStatus(id, dto.status);

    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'user.set_liveness_status',
      entityType: 'user',
      entityId: id,
      metadata: { status: dto.status },
    });

    return result;
  }

  @Get(':id/subscription/history')
  @Roles(AdminRole.moderator, AdminRole.super_admin)
  getSubscriptionHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.getSubscriptionHistory(id);
  }

  @Post(':id/subscription/grant-premium')
  @Roles(AdminRole.moderator, AdminRole.super_admin)
  async grantPremium(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: { id: string },
    @Body() body: { note?: string },
  ) {
    const result = await this.users.grantPremium(id, admin.id, body.note);

    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'user.grant_premium',
      entityType: 'user',
      entityId: id,
      metadata: { note: body.note },
    });

    return result;
  }

  @Post(':id/subscription/revoke-premium')
  @Roles(AdminRole.moderator, AdminRole.super_admin)
  async revokePremium(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: { id: string },
  ) {
    const result = await this.users.revokePremium(id);

    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'user.revoke_premium',
      entityType: 'user',
      entityId: id,
    });

    return result;
  }

  @Patch(':id/status')
  @Roles(AdminRole.moderator, AdminRole.super_admin)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentAdmin() admin: { id: string },
  ) {
    const result = await this.users.updateStatus(id, dto.status, dto.note);

    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'user.status_update',
      entityType: 'user',
      entityId: id,
      metadata: { status: dto.status, note: dto.note },
    });

    return result;
  }
}
