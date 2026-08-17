import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Profile, Prisma, UserStatus, WallPostStatus, WallReplyStatus } from '@pingme/db';
import { ACCOUNT_DELETION_GRACE_DAYS, PREMIUM_AVATAR_THEMES, CancelAccountDeletionInput, DeleteAccountInput, MediaConfirmInput, MediaPresignInput, UpdateProfileInput, UpdateSettingsInput } from '@pingme/shared';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { AppConfigService } from '../config/app-config.service';
import { R2Service } from '../common/services/r2.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.module';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { VerificationService } from '../verification/verification.service';
import { ReputationService } from '../reputation/reputation.service';
import { assertSafeAvatarObjectKey } from '../common/utils/upload-key.util';

const GEO_AVAILABLE_KEY = 'geo:available';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly appConfig: AppConfigService,
    private readonly r2: R2Service,
    private readonly verification: VerificationService,
    private readonly subscriptions: SubscriptionsService,
    private readonly redis: RedisService,
    private readonly reputation: ReputationService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, settings: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [livenessVerified, idVerified, subscription, reputation] = await Promise.all([
      this.verification.hasPassedLiveness(userId),
      this.verification.hasPassedIdVerification(userId),
      this.subscriptions.getSubscriptionView(userId),
      this.reputation.getMeReputation(userId),
    ]);
    const { passwordHash: _passwordHash, ...safe } = user;
    return { ...safe, livenessVerified, idVerified, subscription, reputation };
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

    const payload = { ...dto };
    if (dto.radiusMeters !== undefined) {
      const { minMeters, maxMeters } = this.appConfig.getDistanceConfig().wall;
      const clamped = this.appConfig.clampWallRadius(dto.radiusMeters);
      if (clamped !== dto.radiusMeters) {
        throw new BadRequestException(
          `radiusMeters must be between ${minMeters} and ${maxMeters}`,
        );
      }
      payload.radiusMeters = clamped;
    }

    return this.prisma.userSettings.upsert({
      where: { userId },
      update: payload,
      create: {
        userId,
        radiusMeters: payload.radiusMeters ?? this.appConfig.getDistanceConfig().wall.defaultMeters,
        ...payload,
      },
    });
  }

  async getSettings(userId: string) {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (!settings) {
      const created = await this.prisma.userSettings.create({
        data: {
          userId,
          radiusMeters: this.appConfig.getDistanceConfig().wall.defaultMeters,
        },
      });
      return this.normalizeSettings(created);
    }
    return this.normalizeSettings(settings);
  }

  private normalizeSettings<T extends { radiusMeters: number }>(settings: T): T {
    return {
      ...settings,
      radiusMeters: this.appConfig.resolveWallRadius(settings.radiusMeters),
    };
  }

  async scheduleAccountDeletion(
    userId: string,
    dto: DeleteAccountInput,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    if (user.deletionScheduledAt) {
      throw new ConflictException('Account deletion is already scheduled');
    }

    if (!user.passwordHash) {
      throw new BadRequestException('Password confirmation is not available for this account');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Incorrect password');
    }

    const subscription = await this.subscriptions.getSubscriptionView(userId);
    if (subscription.isPremium && !subscription.cancelAtPeriodEnd) {
      throw new ForbiddenException(
        'Cancel your Premium subscription in the app store before deleting your account',
      );
    }

    const effectiveAt = new Date(
      Date.now() + ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletionScheduledAt: effectiveAt,
        isAvailable: false,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.prisma.presenceSession.updateMany({
      where: { userId },
      data: {
        isActive: false,
        endedAt: new Date(),
        latitude: null,
        longitude: null,
        fuzzyLat: null,
        fuzzyLng: null,
      },
    });

    try {
      await this.redis.client.zrem(GEO_AVAILABLE_KEY, userId);
    } catch {
      // best effort
    }

    await this.audit.log({
      userId,
      action: 'user.delete.scheduled',
      entityType: 'user',
      entityId: userId,
      metadata: { effectiveAt: effectiveAt.toISOString() },
      ...meta,
    });

    return {
      scheduled: true,
      graceDays: ACCOUNT_DELETION_GRACE_DAYS,
      effectiveAt: effectiveAt.toISOString(),
    };
  }

  async cancelAccountDeletion(
    userId: string,
    dto: CancelAccountDeletionInput,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    if (!user.deletionScheduledAt) {
      throw new BadRequestException('No account deletion is scheduled');
    }

    if (!user.passwordHash) {
      throw new BadRequestException('Password confirmation is not available for this account');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Incorrect password');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { deletionScheduledAt: null },
    });

    await this.audit.log({
      userId,
      action: 'user.delete.cancelled',
      entityType: 'user',
      entityId: userId,
      ...meta,
    });

    return { cancelled: true };
  }

  async finalizeScheduledDeletions(): Promise<number> {
    const due = await this.prisma.user.findMany({
      where: {
        deletionScheduledAt: { lte: new Date() },
        deletedAt: null,
      },
      select: { id: true },
    });

    for (const row of due) {
      await this.purgeAccount(row.id, {});
    }

    return due.length;
  }

  async purgeAccount(userId: string, meta: { ipAddress?: string; userAgent?: string }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.deleted,
          deletedAt: new Date(),
          deletionScheduledAt: null,
          email: null,
          phone: null,
          passwordHash: null,
          isAvailable: false,
        },
      });

      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.profile.updateMany({
        where: { userId },
        data: {
          displayName: 'Deleted User',
          bio: null,
          avatarUrl: null,
          avatarConfig: Prisma.DbNull,
          avatarType: 'generated',
        },
      });

      await tx.wallPost.updateMany({
        where: { userId, status: WallPostStatus.active },
        data: { status: WallPostStatus.deleted },
      });

      await tx.wallReply.updateMany({
        where: { userId, status: WallReplyStatus.active },
        data: { status: WallReplyStatus.deleted },
      });

      await tx.device.deleteMany({ where: { userId } });

      await tx.presenceSession.updateMany({
        where: { userId },
        data: {
          isActive: false,
          endedAt: new Date(),
          latitude: null,
          longitude: null,
          fuzzyLat: null,
          fuzzyLng: null,
        },
      });
    });

    try {
      await this.redis.client.zrem(GEO_AVAILABLE_KEY, userId);
    } catch {
      // Deletion must succeed even if Redis is briefly unavailable
    }

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
    const safeName = dto.fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 180) || 'avatar';
    const key = assertSafeAvatarObjectKey(userId, `avatars/${userId}/${Date.now()}-${safeName}`);
    return this.r2.createPresignedUpload(key, dto.contentType);
  }

  async confirmUpload(userId: string, dto: MediaConfirmInput): Promise<Profile> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const safeKey = assertSafeAvatarObjectKey(userId, dto.key);
    const publicUrl = this.r2.getPublicUrl(safeKey);

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

    const safeKey = assertSafeAvatarObjectKey(userId, key);

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    const publicUrl = await this.r2.saveLocalFile(safeKey, file.buffer);

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
