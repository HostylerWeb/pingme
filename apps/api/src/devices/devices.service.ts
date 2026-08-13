import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/devices.dto';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, dto: RegisterDeviceDto) {
    const device = await this.prisma.device.upsert({
      where: {
        userId_pushToken: {
          userId,
          pushToken: dto.pushToken,
        },
      },
      update: {
        platform: dto.platform,
        deviceId: dto.deviceId,
        appVersion: dto.appVersion,
        lastActiveAt: new Date(),
      },
      create: {
        userId,
        platform: dto.platform,
        pushToken: dto.pushToken,
        deviceId: dto.deviceId,
        appVersion: dto.appVersion,
        lastActiveAt: new Date(),
      },
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

  async getTokensForUser(userId: string) {
    const devices = await this.prisma.device.findMany({
      where: { userId },
      select: { pushToken: true },
    });
    return devices.map((device) => device.pushToken);
  }
}
