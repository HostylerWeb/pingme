import { Injectable, NotFoundException } from '@nestjs/common';
import { Profile, User, UserStatus } from '@pingme/db';
import { AuditService } from '../audit/audit.service';
import { R2Service } from '../common/services/r2.service';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationService } from '../verification/verification.service';
import {
  MediaConfirmInput,
  MediaPresignInput,
  UpdateProfileInput,
  UpdateSettingsInput,
} from '@pingme/shared';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly r2: R2Service,
    private readonly verification: VerificationService,
  ) {}

  async getMe(user: User) {
    const livenessVerified = await this.verification.hasPassedLiveness(user.id);
    const { passwordHash: _passwordHash, ...safe } = user;
    return { ...safe, livenessVerified };
  }

  async updateProfile(userId: string, dto: UpdateProfileInput): Promise<Profile> {
    const profile = await this.prisma.profile.upsert({
      where: { userId },
      update: {
        displayName: dto.displayName,
        bio: dto.bio,
        avatarType: dto.avatarType,
        dateOfBirth: dto.dateOfBirth,
      },
      create: {
        userId,
        displayName: dto.displayName ?? 'User',
        bio: dto.bio,
        avatarType: dto.avatarType,
        dateOfBirth: dto.dateOfBirth ?? new Date('1995-01-01'),
      },
    });

    await this.audit.log({
      userId,
      action: 'profile.update',
      entityType: 'profile',
      entityId: profile.id,
    });

    return profile;
  }

  async updateSettings(userId: string, dto: UpdateSettingsInput) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      update: { ...dto },
      create: { userId, ...dto },
    });
  }

  async getSettings(userId: string) {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (!settings) {
      return this.prisma.userSettings.create({ data: { userId } });
    }
    return settings;
  }

  async deleteAccount(userId: string, meta: { ipAddress?: string; userAgent?: string }) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.deleted,
          deletedAt: new Date(),
          email: null,
          phone: null,
          isAvailable: false,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.log({
      userId,
      action: 'user.delete',
      entityType: 'user',
      entityId: userId,
      ...meta,
    });

    return { success: true };
  }

  async createPresignedUpload(userId: string, dto: MediaPresignInput) {
    const key = `avatars/${userId}/${Date.now()}-${dto.fileName}`;
    return this.r2.createPresignedUpload(key, dto.contentType);
  }

  async confirmUpload(userId: string, dto: MediaConfirmInput): Promise<Profile> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const publicUrl = this.r2.getPublicUrl(dto.key);

    return this.prisma.profile.update({
      where: { userId },
      data: {
        avatarUrl: publicUrl,
        avatarType: 'photo',
      },
    });
  }
}
