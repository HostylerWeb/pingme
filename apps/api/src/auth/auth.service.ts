import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, OtpType, Prisma, User, UserStatus } from '@pingme/db';
import * as bcrypt from 'bcrypt';
import { MIN_AGE_YEARS, SignUpInput, LoginInput, ForgotPasswordInput, ResetPasswordInput, VerifyOtpInput } from '@pingme/shared';
import { AuditService } from '../audit/audit.service';
import { SecurityEventsService } from '../audit/security-events.service';
import { EmailService } from '../common/services/email.service';
import { SmsService } from '../common/services/sms.service';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationService } from '../verification/verification.service';
import {
  generateOtpCode,
  generateRefreshToken,
  generateResetToken,
  hashToken,
} from '../common/utils/crypto.util';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email?: string | null;
  phone?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly securityEvents: SecurityEventsService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly verification: VerificationService,
  ) {}

  async register(dto: SignUpInput, meta: { ipAddress?: string; userAgent?: string }) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    const email = this.normalizeEmail(dto.email);
    const dateOfBirth = dto.dateOfBirth;
    this.assertMinimumAge(dateOfBirth);

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          email ? { email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as { email?: string; phone?: string }[],
      },
    });

    if (existing) {
      throw new ConflictException('Account already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const displayName =
      dto.displayName?.trim() ||
      (email ? email.split('@')[0] : `user_${dto.phone?.slice(-4)}`);

    const user = await this.prisma.user.create({
      data: {
        email,
        phone: dto.phone,
        passwordHash,
        authProvider: dto.phone ? AuthProvider.phone : AuthProvider.email,
        status: UserStatus.pending_verification,
        profile: {
          create: {
            displayName,
            dateOfBirth,
            gender: dto.gender,
          },
        },
        settings: { create: {} },
      },
      include: { profile: true, settings: true },
    });

    await this.audit.log({
      userId: user.id,
      action: 'auth.register',
      entityType: 'user',
      entityId: user.id,
      ...meta,
    });
    await this.securityEvents.log({
      userId: user.id,
      action: 'auth.register',
      ...meta,
    });

    const tokens = await this.issueTokens(user);

    if (email) {
      await this.sendEmailOtp(user.id);
    }
    if (dto.phone) {
      await this.sendPhoneOtp(user.id);
    }

    return { user: await this.enrichAuthUser(user), ...tokens };
  }

  async login(dto: LoginInput, meta: { ipAddress?: string; userAgent?: string }) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findFirst({
      where: email ? { email } : { phone: dto.phone },
      include: { profile: true, settings: true },
    });

    if (!user || !user.passwordHash || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.suspended) {
      throw new UnauthorizedException('Account suspended');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      ...meta,
    });
    await this.securityEvents.log({
      userId: user.id,
      action: 'auth.login',
      ...meta,
    });

    const tokens = await this.issueTokens(user);
    return { user: await this.enrichAuthUser(user), ...tokens };
  }

  async refresh(refreshToken: string, meta: { ipAddress?: string; userAgent?: string } = {}) {
    const tokenHash = hashToken(refreshToken);

    const result = await this.prisma.$transaction(async (tx) => {
      const stored = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: {
          user: { include: { profile: true, settings: true } },
        },
      });

      if (!stored || stored.user.deletedAt) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (stored.revokedAt != null) {
        await tx.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException('Session revoked — log in again');
      }

      if (stored.expiresAt <= new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const revoked = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (revoked.count === 0) {
        await tx.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException('Session revoked — log in again');
      }

      const tokens = await this.issueTokens(stored.user, tx);
      return { user: stored.user, tokens };
    });

    await this.securityEvents.log({
      userId: result.user.id,
      action: 'auth.refresh',
      ...meta,
    });

    return { user: await this.enrichAuthUser(result.user), ...result.tokens };
  }

  async logout(userId: string, refreshToken: string | undefined, meta: { ipAddress?: string; userAgent?: string }) {
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.log({
      userId,
      action: 'auth.logout',
      entityType: 'user',
      entityId: userId,
      ...meta,
    });
    await this.securityEvents.log({
      userId,
      action: 'auth.logout',
      ...meta,
    });

    return { success: true };
  }

  async sendEmailOtp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) {
      throw new BadRequestException('No email on account');
    }

    const code = await this.createOtp(userId, OtpType.email_verify);
    await this.emailService.sendOtp(user.email, code);

    return { success: true, message: 'Verification code sent' };
  }

  async sendPhoneOtp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.phone) {
      throw new BadRequestException('No phone on account');
    }

    if (this.smsService.usesTwilioVerify()) {
      await this.smsService.sendOtp(user.phone, '');
      return { success: true, message: 'Verification code sent' };
    }

    const code = await this.createOtp(userId, OtpType.phone_verify);
    await this.smsService.sendOtp(user.phone, code);

    return { success: true, message: 'Verification code sent' };
  }

  async verifyEmail(userId: string, dto: VerifyOtpInput) {
    await this.verifyOtp(userId, OtpType.email_verify, dto.code);
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true, status: UserStatus.active },
    });
    return { success: true, verified: true };
  }

  async verifyPhone(userId: string, dto: VerifyOtpInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.phone) {
      throw new BadRequestException('No phone on account');
    }

    if (this.smsService.usesTwilioVerify()) {
      const approved = await this.smsService.verifyOtp(user.phone, dto.code);
      if (!approved) {
        throw new BadRequestException('Invalid or expired code');
      }
    } else {
      await this.verifyOtp(userId, OtpType.phone_verify, dto.code);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerified: true, status: UserStatus.active },
    });
    return { success: true, verified: true };
  }

  async forgotPassword(dto: ForgotPasswordInput) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findFirst({
      where: email ? { email } : { phone: dto.phone },
    });

    const generic = {
      success: true as const,
      message: 'If the account exists, a reset link was sent',
    };

    // Always hash a token so missing vs existing accounts share similar CPU cost.
    const token = generateResetToken();
    const tokenHash = hashToken(token);

    if (!user || user.deletedAt) {
      return generic;
    }

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    if (this.config.get('NODE_ENV') === 'development') {
      console.log(`[DEV] Password reset token for ${user.email ?? user.phone}: ${token}`);
    } else if (user.email) {
      // Do not await delivery — avoids cold-path timing oracle vs missing accounts.
      void this.emailService.sendPasswordReset(user.email, token).catch(() => undefined);
    } else if (user.phone) {
      void this.smsService
        .sendText(
          user.phone,
          `Your PingMe password reset code: ${token}. It expires in 1 hour.`,
        )
        .catch(() => undefined);
    }

    return generic;
  }

  async resetPassword(dto: ResetPasswordInput) {
    const tokenHash = hashToken(dto.token);
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.usedAt || stored.expiresAt <= new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { success: true };
  }

  private async issueTokens(
    user: User,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = generateRefreshToken();
    const refreshDays = Number(this.config.get('JWT_REFRESH_DAYS', 30));

    await db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private async createOtp(userId: string, type: OtpType) {
    const code = generateOtpCode();
    const codeHash = hashToken(code);

    await this.prisma.otpCode.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.prisma.otpCode.create({
      data: {
        userId,
        type,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return code;
  }

  private async verifyOtp(userId: string, type: OtpType, code: string) {
    const codeHash = hashToken(code);
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        userId,
        type,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new BadRequestException('Invalid or expired code');
    }

    if (otp.attemptCount >= 5) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      });
      throw new BadRequestException('Too many attempts');
    }

    if (otp.codeHash !== codeHash) {
      const nextAttempts = otp.attemptCount + 1;
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: {
          attemptCount: nextAttempts,
          ...(nextAttempts >= 5 ? { usedAt: new Date() } : {}),
        },
      });
      throw new BadRequestException('Invalid or expired code');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });
  }

  private assertMinimumAge(dateOfBirth: Date) {
    const today = new Date();
    const minBirthDate = new Date(
      today.getFullYear() - MIN_AGE_YEARS,
      today.getMonth(),
      today.getDate(),
    );
    if (dateOfBirth > minBirthDate) {
      throw new BadRequestException(`You must be at least ${MIN_AGE_YEARS} years old`);
    }
  }

  private normalizeEmail(email?: string | null): string | undefined {
    if (!email) return undefined;
    return email.trim().toLowerCase();
  }

  private sanitizeUser(user: User & { profile?: unknown; settings?: unknown }) {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  private async enrichAuthUser(user: User & { profile?: unknown; settings?: unknown }) {
    const livenessVerified = await this.verification.hasPassedLiveness(user.id);
    return { ...this.sanitizeUser(user), livenessVerified };
  }
}
