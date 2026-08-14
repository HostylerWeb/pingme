import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Profile, Prisma, UserStatus } from '@pingme/db';
import { PREMIUM_AVATAR_THEMES } from '@pingme/shared';
import { AuditService } from '../audit/audit.service';
import { R2Service } from '../common/services/r2.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
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
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, settings: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [livenessVerified, subscription] = await Promise.all([
      this.verification.hasPassedLiveness(userId),
      this.subscriptions.getSubscriptionView(userId),
    ]);
    const { passwordHash: _passwordHash, ...safe } = user;
    return { ...safe, livenessVerified, subscription };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileInput,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<Profile> {
    let avatarConfig: Record<string, unknown> | undefined;
    const existing = await this.prisma.profile.findUnique({ where: { userId } });

    if (dto.gender !== undefined && existing?.gender != null) {
      throw new ForbiddenException('Gender cannot be changed after it is set');
    }

    if (dto.avatarTheme !== undefined) {
      const isPremium = await this.subscriptions.isPremium(userId);
      if (!isPremium) {
        throw new ForbiddenException('Premium subscription required for avatar themes');
      }

      const allowed = PREMIUM_AVATAR_THEMES.some((theme) => theme.id === dto.avatarTheme);
      if (!allowed) {
        throw new ForbiddenException('Invalid avatar theme');
      }

      avatarConfig = {
        ...((existing?.avatarConfig as Record<string, unknown> | null) ?? {}),
        theme: dto.avatarTheme,
      };
    }

    const updateData: Prisma.ProfileUpdateInput = {};
    if (dto.displayName !== undefined) updateData.displayName = dto.displayName;
    if (dto.bio !== undefined) updateData.bio = dto.bio;
    if (dto.avatarType !== undefined) updateData.avatarType = dto.avatarType;
    if (dto.dateOfBirth !== undefined) updateData.dateOfBirth = dto.dateOfBirth;
    if (dto.gender !== undefined && (existing == null || existing.gender == null)) {
      updateData.gender = dto.gender;
    }
    if (avatarConfig !== undefined) {
      updateData.avatarConfig = avatarConfig as Prisma.InputJsonValue;
    }

    const profile = existing
      ? await this.prisma.profile.update({
          where: { userId },
          data: updateData,
        })
      : await this.prisma.profile.create({
          data: {
            userId,
            displayName: dto.displayName ?? 'User',
            bio: dto.bio,
            avatarType: dto.avatarType,
            dateOfBirth: dto.dateOfBirth ?? new Date('1995-01-01'),
            gender: dto.gender,
            ...(avatarConfig !== undefined
              ? { avatarConfig: avatarConfig as Prisma.InputJsonValue }
              : {}),
          },
        });

    await this.audit.log({
      userId,
      action: 'profile.update',
      entityType: 'profile',
      entityId: profile.id,
      ...meta,
      ...(dto.gender !== undefined ? { metadata: { genderSet: true } } : {}),
    });

    return profile;
  }

  async updateSettings(userId: string, dto: UpdateSettingsInput) {
    if (dto.showReadReceipts === true) {
      const isPremium = await this.subscriptions.isPremium(userId);
      if (!isPremium) {
        throw new ForbiddenException('Premium subscription required for read receipts');
      }
    }

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

    if (!dto.key.startsWith(`avatars/${userId}/`)) {
      throw new ForbiddenException('Invalid upload key');
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

  async uploadAvatarDirect(
    userId: string,
    key: string,
    file: { buffer: Buffer; mimetype: string },
  ): Promise<Profile> {
    if (this.r2.isConfigured()) {
      throw new BadRequestException('Direct upload is only used when R2 is not configured');
    }

    if (!key.startsWith(`avatars/${userId}/`)) {
      throw new ForbiddenException('Invalid upload key');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    const publicUrl = await this.r2.saveLocalFile(key, file.buffer);

    return this.prisma.profile.update({
      where: { userId },
      data: {
        avatarUrl: publicUrl,
        avatarType: 'photo',
      },
    });
  }

  async exportUserData(userId: string): Promise<{
    exportedAt: string;
    user: Record<string, unknown>;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        settings: true,
        wallPosts: { take: 500, orderBy: { createdAt: 'desc' } },
        wallReplies: { take: 500, orderBy: { createdAt: 'desc' } },
        messagesSent: { take: 500, orderBy: { createdAt: 'desc' } },
        reportsFiled: { take: 100, orderBy: { createdAt: 'desc' } },
        verifications: { orderBy: { createdAt: 'desc' } },
        devices: { select: { id: true, platform: true, createdAt: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash: _passwordHash, ...safeUser } = user;

    await this.audit.log({
      userId,
      action: 'user.export',
      entityType: 'user',
      entityId: userId,
    });

    return {
      exportedAt: new Date().toISOString(),
      user: safeUser as Record<string, unknown>,
    };
  }
}
