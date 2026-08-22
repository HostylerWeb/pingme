import { Body, Controller, Delete, Get, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CancelAccountDeletionSchema,
  DeleteAccountSchema,
  MediaConfirmSchema,
  MediaPresignSchema,
  MediaUploadBase64Schema,
  UpdateContactSchema,
  UpdateProfileSchema,
  UpdateSettingsSchema,
  CancelAccountDeletionInput,
  DeleteAccountInput,
  MediaConfirmInput,
  MediaPresignInput,
  MediaUploadBase64Input,
  UpdateContactInput,
  UpdateProfileInput,
  UpdateSettingsInput,
} from '@pingme/shared';
import { User, Profile } from '@pingme/db';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { getRequestMeta } from '../common/utils/crypto.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users/me')
  @ApiOperation({ summary: 'Get current user' })
  async getMe(@CurrentUser() user: User): Promise<{ success: boolean; data: unknown }> {
    const data = await this.usersService.getMe(user.id);
    return { success: true, data };
  }

  @Patch('users/me/profile')
  @ApiOperation({ summary: 'Update profile' })
  async updateProfile(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) dto: UpdateProfileInput,
    @Req() req: Request,
  ): Promise<{ success: boolean; data: Profile }> {
    const data = await this.usersService.updateProfile(user.id, dto, getRequestMeta(req));
    return { success: true, data };
  }

  @Patch('users/me/contact')
  @ApiOperation({ summary: 'Update phone number' })
  async updateContact(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(UpdateContactSchema)) dto: UpdateContactInput,
    @Req() req: Request,
  ) {
    const data = await this.usersService.updateContact(user.id, dto, getRequestMeta(req));
    return { success: true, data };
  }

  @Patch('users/me/settings')
  @ApiOperation({ summary: 'Update settings' })
  async updateSettings(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(UpdateSettingsSchema)) dto: UpdateSettingsInput,
  ) {
    const data = await this.usersService.updateSettings(user.id, dto);
    return { success: true, data };
  }

  @Get('users/me/settings')
  @ApiOperation({ summary: 'Get notification and app settings' })
  async getSettings(@CurrentUser() user: User) {
    const data = await this.usersService.getSettings(user.id);
    return { success: true, data };
  }

  @Delete('users/me')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Schedule account deletion (grace period)' })
  async deleteAccount(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(DeleteAccountSchema)) dto: DeleteAccountInput,
    @Req() req: Request,
  ) {
    const data = await this.usersService.scheduleAccountDeletion(user.id, dto, getRequestMeta(req));
    return { success: true, data };
  }

  @Post('users/me/delete/cancel')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cancel a scheduled account deletion' })
  async cancelAccountDeletion(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(CancelAccountDeletionSchema)) dto: CancelAccountDeletionInput,
    @Req() req: Request,
  ) {
    const data = await this.usersService.cancelAccountDeletion(user.id, dto, getRequestMeta(req));
    return { success: true, data };
  }

  @Get('users/me/export')
  @ApiOperation({ summary: 'Export user data (GDPR)' })
  async exportData(@CurrentUser() user: User): Promise<{ success: boolean; data: unknown }> {
    const data = await this.usersService.exportUserData(user.id);
    return { success: true, data };
  }

  @Post('media/presign')
  @ApiOperation({ summary: 'Get avatar upload URL' })
  async presign(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(MediaPresignSchema)) dto: MediaPresignInput,
  ) {
    const data = await this.usersService.createPresignedUpload(user.id, dto);
    return { success: true, data };
  }

  @Post('media/upload')
  @ApiOperation({ summary: 'Upload avatar directly (fallback when R2 is not configured)' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadMedia(
    @CurrentUser() user: User,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string },
    @Body('key') key: string,
  ): Promise<{ success: boolean; data: Profile }> {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!key) {
      throw new BadRequestException('Upload key is required');
    }
    const data = await this.usersService.uploadAvatarDirect(user.id, key, {
      buffer: file.buffer,
      mimetype: file.mimetype,
    });
    return { success: true, data };
  }

  @Post('media/upload-base64')
  @ApiOperation({ summary: 'Upload avatar as base64 (fallback when R2 is not configured)' })
  async uploadBase64(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(MediaUploadBase64Schema)) dto: MediaUploadBase64Input,
  ): Promise<{ success: boolean; data: Profile }> {
    const buffer = Buffer.from(dto.data, 'base64');
    const data = await this.usersService.uploadAvatarDirect(user.id, dto.key, {
      buffer,
      mimetype: dto.contentType,
    });
    return { success: true, data };
  }

  @Post('media/confirm')
  @ApiOperation({ summary: 'Confirm avatar upload' })
  async confirm(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(MediaConfirmSchema)) dto: MediaConfirmInput,
  ): Promise<{ success: boolean; data: Profile }> {
    const data = await this.usersService.confirmUpload(user.id, dto);
    return { success: true, data };
  }
}
