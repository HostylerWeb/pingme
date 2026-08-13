import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, OtpType, User, UserStatus } from '@pingme/db';
import * as bcrypt from 'bcrypt';
import { MIN_AGE_YEARS, SignUpInput, LoginInput, ForgotPasswordInput, ResetPasswordInput, VerifyOtpInput } from '@pingme/shared';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../common/services/email.service';
import { SmsService } from '../common/services/sms.service';
import { PrismaService } from '../prisma/prisma.service';
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
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  async register(dto: SignUpInput, meta: { ipAddress?: string; userAgent?: string }) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    const dateOfBirth = dto.dateOfBirth;
    this.assertMinimumAge(dateOfBirth);

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
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
      (dto.email ? dto.email.split('@')[0] : `user_${dto.phone?.slice(-4)}`);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        authProvider: dto.phone ? AuthProvider.phone : AuthProvider.email,
        status: UserStatus.pending_verification,
        profile: {
          create: {
            displayName,
            dateOfBirth,
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

    const tokens = await this.issueTokens(user);

    if (dto.email) {
      await this.sendEmailOtp(user.id);
    }
    if (dto.phone) {
      await this.sendPhoneOtp(user.id);
    }

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginInput, meta: { ipAddress?: string; userAgent?: string }) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    const user = await this.prisma.user.findFirst({
      where: dto.email ? { email: dto.email } : { phone: dto.phone },
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

    const tokens = await this.issueTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { include: { profile: true, settings: true } },
      },
    });

    if (!stored || stored.user.deletedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(stored.user);
    return { user: this.sanitizeUser(stored.user), ...tokens };
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
    await this.verifyOtp(userId, OtpType.phone_verify, dto.code);
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

    const user = await this.prisma.user.findFirst({
      where: dto.email ? { email: dto.email } : { phone: dto.phone },
    });

    if (!user) {
      return { success: true, message: 'If the account exists, a reset link was sent' };
    }

    const token = generateResetToken();
    const tokenHash = hashToken(token);

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
      await this.emailService.sendPasswordReset(user.email, token);
    }

    return { success: true, message: 'If the account exists, a reset link was sent' };
  }

  async resetPassword(dto: ResetPasswordInput) {
    const tokenHash = hashToken(dto.token);
    const stored = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) {
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

  private async issueTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = generateRefreshToken();
    const refreshDays = Number(this.config.get('JWT_REFRESH_DAYS', 30));

    await this.prisma.refreshToken.create({
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
        codeHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otp) {
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

  private sanitizeUser(user: User & { profile?: unknown; settings?: unknown }) {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }
}
