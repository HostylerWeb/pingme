import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  UserStatus,
  VerificationProvider,
  VerificationStatus,
  VerificationType,
} from '@pingme/db';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface UpdateAdminUserInput {
  email?: string | null;
  phone?: string | null;
  displayName?: string;
  bio?: string | null;
  radiusMeters?: number;
  quietMode?: boolean;
}

export interface UpdateVerificationFlagsInput {
  emailVerified?: boolean;
  phoneVerified?: boolean;
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async list(params: { q?: string; status?: UserStatus; page?: number; limit?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      ...(params.status === UserStatus.deleted
        ? { status: UserStatus.deleted }
        : {
            deletedAt: null,
            ...(params.status ? { status: params.status } : {}),
          }),
      ...(params.q
        ? {
            OR: [
              { email: { contains: params.q, mode: 'insensitive' } },
              { phone: { contains: params.q, mode: 'insensitive' } },
              { profile: { displayName: { contains: params.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: { select: { displayName: true, avatarUrl: true } },
          verifications: {
            where: { type: VerificationType.liveness, status: VerificationStatus.passed },
            take: 1,
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((user) => ({
        id: user.id,
        email: user.email,
        phone: user.phone,
        status: user.status,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        livenessVerified: user.verifications.length > 0,
        displayName: user.profile?.displayName ?? null,
        avatarUrl: user.profile?.avatarUrl ?? null,
        createdAt: user.createdAt,
        lastSeenAt: user.lastSeenAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        settings: true,
        verifications: { orderBy: { createdAt: 'desc' } },
        _count: {
          select: {
            wallPosts: true,
            reportsReceived: true,
            reportsFiled: true,
            devices: true,
            blocksInitiated: true,
            blocksReceived: true,
            matchesAsUserA: true,
            matchesAsUserB: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const livenessVerified = user.verifications.some(
      (v) =>
        v.type === VerificationType.liveness &&
        v.status === VerificationStatus.passed &&
        (!v.expiresAt || v.expiresAt > new Date()),
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        status: user.status,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        livenessVerified,
        isAvailable: user.isAvailable,
        createdAt: user.createdAt,
        lastSeenAt: user.lastSeenAt,
        deletedAt: user.deletedAt,
        profile: user.profile,
        settings: user.settings,
        verifications: user.verifications,
        counts: user._count,
      },
    };
  }

  async updateUser(id: string, input: UpdateAdminUserInput) {
    const user = await this.requireUser(id);

    if (input.email !== undefined && input.email !== user.email) {
      if (input.email) {
        const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
        if (existing && existing.id !== id) {
          throw new ConflictException('Email already in use');
        }
      }
    }

    if (input.phone !== undefined && input.phone !== user.phone) {
      if (input.phone) {
        const existing = await this.prisma.user.findUnique({ where: { phone: input.phone } });
        if (existing && existing.id !== id) {
          throw new ConflictException('Phone already in use');
        }
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.displayName !== undefined || input.bio !== undefined
          ? {
              profile: {
                update: {
                  ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
                  ...(input.bio !== undefined ? { bio: input.bio } : {}),
                },
              },
            }
          : {}),
        ...(input.radiusMeters !== undefined || input.quietMode !== undefined
          ? {
              settings: {
                update: {
                  ...(input.radiusMeters !== undefined ? { radiusMeters: input.radiusMeters } : {}),
                  ...(input.quietMode !== undefined ? { quietMode: input.quietMode } : {}),
                },
              },
            }
          : {}),
      },
      include: { profile: true, settings: true },
    });

    return updated;
  }

  async updateVerificationFlags(id: string, input: UpdateVerificationFlagsInput) {
    await this.requireUser(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(input.emailVerified !== undefined ? { emailVerified: input.emailVerified } : {}),
        ...(input.phoneVerified !== undefined ? { phoneVerified: input.phoneVerified } : {}),
      },
      select: { id: true, emailVerified: true, phoneVerified: true },
    });
  }

  async resendEmailVerification(id: string) {
    await this.requireUser(id);
    return this.authService.sendEmailOtp(id);
  }

  async resendPhoneVerification(id: string) {
    await this.requireUser(id);
    return this.authService.sendPhoneOtp(id);
  }

  async resetLiveness(id: string) {
    await this.requireUser(id);

    await this.prisma.verification.deleteMany({
      where: { userId: id, type: VerificationType.liveness },
    });

    return { success: true, message: 'Liveness verification reset — user must re-verify' };
  }

  async setLivenessStatus(id: string, status: VerificationStatus) {
    const user = await this.requireUser(id);

    if (!['passed', 'failed', 'pending', 'expired'].includes(status)) {
      throw new BadRequestException('Invalid verification status');
    }

    const latest = await this.prisma.verification.findFirst({
      where: { userId: id, type: VerificationType.liveness },
      orderBy: { createdAt: 'desc' },
    });

    if (latest) {
      return this.prisma.verification.update({
        where: { id: latest.id },
        data: {
          status,
          verifiedAt: status === VerificationStatus.passed ? new Date() : null,
          expiresAt: status === VerificationStatus.passed ? null : latest.expiresAt,
        },
      });
    }

    return this.prisma.verification.create({
      data: {
        userId: user.id,
        type: VerificationType.liveness,
        provider: VerificationProvider.didit,
        status,
        verifiedAt: status === VerificationStatus.passed ? new Date() : null,
        metadata: { adminOverride: true },
      },
    });
  }

  async updateStatus(id: string, status: UserStatus, note?: string) {
    const user = await this.requireUser(id);

    const data: Prisma.UserUpdateInput = { status };

    if (status === UserStatus.deleted) {
      data.deletedAt = new Date();
    } else if (user.status === UserStatus.deleted) {
      data.deletedAt = null;
    }

    if (status === UserStatus.active && user.status === UserStatus.pending_verification) {
      // keep pending_verification unless explicitly verified
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
    });

    return { user: updated, note };
  }

  async getPosts(userId: string, page = 1, limit = 20) {
    await this.requireUser(userId);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.wallPost.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.wallPost.count({ where: { userId } }),
    ]);

    return { items, total, page, limit };
  }

  async getReportsReceived(userId: string, page = 1, limit = 20) {
    await this.requireUser(userId);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where: { reportedUserId: userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: { include: { profile: { select: { displayName: true } } } },
        },
      }),
      this.prisma.report.count({ where: { reportedUserId: userId } }),
    ]);

    return {
      items: items.map((r) => ({
        id: r.id,
        reason: r.reason,
        status: r.status,
        targetType: r.targetType,
        createdAt: r.createdAt,
        reporterDisplayName: r.reporter.profile?.displayName ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  async getChats(userId: string, page = 1, limit = 20) {
    await this.requireUser(userId);
    const skip = (page - 1) * limit;

    const where: Prisma.MatchWhereInput = {
      OR: [{ userAId: userId }, { userBId: userId }],
      chat: { isNot: null },
    };

    const [matches, total] = await Promise.all([
      this.prisma.match.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          chat: { select: { id: true, status: true, createdAt: true } },
          userA: { include: { profile: { select: { displayName: true } } } },
          userB: { include: { profile: { select: { displayName: true } } } },
        },
      }),
      this.prisma.match.count({ where }),
    ]);

    return {
      items: matches.map((m) => {
        const other =
          m.userAId === userId
            ? m.userB.profile?.displayName ?? m.userBId
            : m.userA.profile?.displayName ?? m.userAId;
        return {
          chatId: m.chat?.id ?? null,
          matchId: m.id,
          status: m.status,
          chatStatus: m.chat?.status ?? null,
          otherUserDisplayName: other,
          createdAt: m.createdAt,
        };
      }),
      total,
      page,
      limit,
    };
  }

  async getDevices(userId: string) {
    await this.requireUser(userId);

    const devices = await this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
    });

    return { items: devices };
  }

  async getBlocks(userId: string) {
    await this.requireUser(userId);

    const [initiated, received] = await Promise.all([
      this.prisma.block.findMany({
        where: { blockerId: userId },
        include: {
          blocked: { include: { profile: { select: { displayName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.block.findMany({
        where: { blockedId: userId },
        include: {
          blocker: { include: { profile: { select: { displayName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      initiated: initiated.map((b) => ({
        id: b.id,
        userId: b.blockedId,
        displayName: b.blocked.profile?.displayName ?? null,
        createdAt: b.createdAt,
      })),
      received: received.map((b) => ({
        id: b.id,
        userId: b.blockerId,
        displayName: b.blocker.profile?.displayName ?? null,
        createdAt: b.createdAt,
      })),
    };
  }

  async getMatches(userId: string, page = 1, limit = 20) {
    await this.requireUser(userId);
    const skip = (page - 1) * limit;

    const where: Prisma.MatchWhereInput = {
      OR: [{ userAId: userId }, { userBId: userId }],
    };

    const [items, total] = await Promise.all([
      this.prisma.match.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          userA: { include: { profile: { select: { displayName: true } } } },
          userB: { include: { profile: { select: { displayName: true } } } },
          chat: { select: { id: true } },
        },
      }),
      this.prisma.match.count({ where }),
    ]);

    return {
      items: items.map((m) => ({
        id: m.id,
        source: m.source,
        status: m.status,
        chatId: m.chat?.id ?? null,
        otherDisplayName:
          m.userAId === userId
            ? m.userB.profile?.displayName ?? m.userBId
            : m.userA.profile?.displayName ?? m.userAId,
        createdAt: m.createdAt,
        expiresAt: m.expiresAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getUserAuditLogs(userId: string, page = 1, limit = 50) {
    await this.requireUser(userId);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where: { userId } }),
    ]);

    return { items, total, page, limit };
  }

  private async requireUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
