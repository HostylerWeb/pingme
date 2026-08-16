import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DevicePlatform } from '@pingme/db';
import { RegisterDeviceInput } from '@pingme/shared';
import { SecurityEventsService } from '../audit/security-events.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityEvents: SecurityEventsService,
  ) {}

  async register(
    userId: string,
    dto: RegisterDeviceInput,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const device = await this.prisma.device.upsert({
      where: {
        userId_pushToken: {
          userId,
          pushToken: dto.pushToken,
        },
      },
      update: {
        platform: dto.platform as DevicePlatform,
        deviceId: dto.deviceId,
        deviceModel: dto.deviceModel,
        osVersion: dto.osVersion,
        userAgent: dto.userAgent ?? meta.userAgent,
        appVersion: dto.appVersion,
        lastIpAddress: meta.ipAddress,
        lastActiveAt: new Date(),
      },
      create: {
        userId,
        platform: dto.platform as DevicePlatform,
        pushToken: dto.pushToken,
        deviceId: dto.deviceId,
        deviceModel: dto.deviceModel,
        osVersion: dto.osVersion,
        userAgent: dto.userAgent ?? meta.userAgent,
        appVersion: dto.appVersion,
        lastIpAddress: meta.ipAddress,
        lastActiveAt: new Date(),
      },
    });

    await this.securityEvents.log({
      userId,
      action: 'device.register',
      ipAddress: meta.ipAddress,
      userAgent: dto.userAgent ?? meta.userAgent,
      platform: dto.platform as DevicePlatform,
      deviceModel: dto.deviceModel,
      osVersion: dto.osVersion,
      appVersion: dto.appVersion,
      deviceId: dto.deviceId,
      metadata: { deviceRecordId: device.id },
    });

    return { success: true, data: device };
  }

  async list(userId: string) {
    const devices = await this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
    });

    return { success: true, data: devices };
  }

  async remove(userId: string, deviceId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
    if (device.userId !== userId) throw new ForbiddenException('Not your device');

    await this.prisma.device.delete({ where: { id: deviceId } });
    return { success: true };
  }

  async removeByPushToken(userId: string, pushToken: string) {
    await this.prisma.device.deleteMany({
      where: { userId, pushToken },
    });
    return { success: true };
  }

  async getTokensForUser(userId: string) {
    const devices = await this.prisma.device.findMany({
      where: { userId },
      select: { pushToken: true },
    });
    return devices.map((device) => device.pushToken);
  }
}
