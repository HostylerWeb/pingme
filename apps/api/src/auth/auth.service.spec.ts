import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';
import { SecurityEventsService } from '../audit/security-events.service';
import { EmailService } from '../common/services/email.service';
import { SmsService } from '../common/services/sms.service';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationService } from '../verification/verification.service';

describe('AuthService', () => {
  let service: AuthService;

  const prisma: any = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    otpCode: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: any) => Promise<unknown>) => fn(prisma)),
  };

  const audit = { log: jest.fn() };
  const securityEvents = { log: jest.fn() };
  const emailService = { sendOtp: jest.fn(), sendPasswordReset: jest.fn() };
  const smsService = {
    sendOtp: jest.fn(),
    sendText: jest.fn(),
    verifyOtp: jest.fn(),
    usesTwilioVerify: jest.fn().mockReturnValue(false),
  };
  const verification = { hasPassedLiveness: jest.fn().mockResolvedValue(false) };
  const jwtService = { signAsync: jest.fn().mockResolvedValue('access-token') };
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'JWT_REFRESH_DAYS') return '30';
      if (key === 'NODE_ENV') return 'test';
      return fallback;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: SecurityEventsService, useValue: securityEvents },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
        { provide: EmailService, useValue: emailService },
        { provide: SmsService, useValue: smsService },
        { provide: VerificationService, useValue: verification },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('rejects register without email or phone', async () => {
    await expect(
      service.register(
        {
          password: 'Password123!',
          dateOfBirth: '1995-01-01',
        } as never,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects underage users', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.register(
        {
          email: 'young@example.com',
          password: 'Password123!',
          dateOfBirth: new Date(),
          gender: 'male',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate registration', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      service.register(
        {
          email: 'exists@example.com',
          password: 'Password123!',
          dateOfBirth: new Date('1995-01-01'),
          gender: 'female',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: '$2b$12$hashed',
      deletedAt: null,
      status: 'active',
      profile: {},
      settings: {},
    });
    jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.login(
      { email: 'user@example.com', password: 'Password123!' },
      {},
    );

    expect(result.accessToken).toBe('access-token');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login', userId: 'user-1' }),
    );
  });

  it('rejects invalid login credentials', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@example.com', password: 'Password123!' }, {}),
    ).rejects.toThrow('Invalid credentials');
  });

  it('verifies phone with Twilio Verify when configured', async () => {
    smsService.usesTwilioVerify.mockReturnValue(true);
    smsService.verifyOtp.mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', phone: '+15551234567' });
    prisma.user.update.mockResolvedValue({});

    const result = await service.verifyPhone('user-1', { code: '123456' });

    expect(result.verified).toBe(true);
    expect(smsService.verifyOtp).toHaveBeenCalledWith('+15551234567', '123456');
  });

  it('revokes all sessions when a refresh token is reused', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: 'hash',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        deletedAt: null,
        email: 'user@example.com',
        phone: null,
        profile: {},
        settings: {},
      },
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    await expect(service.refresh('stolen-refresh-token', {})).rejects.toThrow(
      'Session revoked — log in again',
    );

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rotates a valid refresh token atomically', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: 'hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        deletedAt: null,
        email: 'user@example.com',
        phone: null,
        profile: {},
        settings: {},
      },
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.refreshToken.create.mockResolvedValue({});
    verification.hasPassedLiveness.mockResolvedValue(false);

    const result = await service.refresh('valid-refresh-token', {});

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBeDefined();
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'rt-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(securityEvents.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.refresh', userId: 'user-1' }),
    );
  });
});
