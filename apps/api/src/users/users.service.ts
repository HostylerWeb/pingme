import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Profile, Prisma, User, UserStatus } from '@pingme/db';
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

  async getMe(user: User) {
    const [livenessVerified, subscription] = await Promise.all([
      this.verification.hasPassedLiveness(user.id),
      this.subscriptions.getSubscriptionView(user.id),
    ]);
    const { passwordHash: _passwordHash, ...safe } = user;
    return { ...safe, livenessVerified, subscription };
  }

  async updateProfile(userId: string, dto: UpdateProfileInput): Promise<Profile> {
    let avatarConfig: Record<string, unknown> | undefined;

    if (dto.avatarTheme !== undefined) {
      const isPremium = await this.subscriptions.isPremium(userId);
      if (!isPremium) {
        throw new ForbiddenException('Premium subscription required for avatar themes');
      }

      const allowed = PREMIUM_AVATAR_THEMES.some((theme) => theme.id === dto.avatarTheme);
      if (!allowed) {
        throw new ForbiddenException('Invalid avatar theme');
      }

      const existing = await this.prisma.profile.findUnique({ where: { userId } });
      avatarConfig = {
        ...((existing?.avatarConfig as Record<string, unknown> | null) ?? {}),
        theme: dto.avatarTheme,
      };
    }

    const profile = await this.prisma.profile.upsert({
      where: { userId },
      update: {
        displayName: dto.displayName,
        bio: dto.bio,
        avatarType: dto.avatarType,
        dateOfBirth: dto.dateOfBirth,
        ...(avatarConfig !== undefined
          ? { avatarConfig: avatarConfig as Prisma.InputJsonValue }
          : {}),
      },
      create: {
        userId,
        displayName: dto.displayName ?? 'User',
        bio: dto.bio,
        avatarType: dto.avatarType,
        dateOfBirth: dto.dateOfBirth ?? new Date('1995-01-01'),
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

    const publicUrl = this.r2.getPublicUrl(dto.key);

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
