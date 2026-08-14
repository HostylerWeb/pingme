import { Injectable } from '@nestjs/common';
import { DevicePlatform, Prisma } from '@pingme/db';
import { PrismaService } from '../prisma/prisma.service';

export interface SecurityEventInput {
  userId: string;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  platform?: DevicePlatform;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  deviceId?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class SecurityEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: SecurityEventInput) {
    await this.prisma.userSecurityEvent.create({
      data: {
        userId: input.userId,
        action: input.action,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        platform: input.platform,
        deviceModel: input.deviceModel,
        osVersion: input.osVersion,
        appVersion: input.appVersion,
        deviceId: input.deviceId,
        metadata: input.metadata,
      },
    });
  }
}
