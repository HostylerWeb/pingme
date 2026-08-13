import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../common/services/email.service';
import { SmsService } from '../common/services/sms.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;

  const prisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
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
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const audit = { log: jest.fn() };
  const emailService = { sendOtp: jest.fn() };
  const smsService = { sendOtp: jest.fn() };
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
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
        { provide: EmailService, useValue: emailService },
        { provide: SmsService, useValue: smsService },
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
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
