import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PresenceExpiryService } from '../presence/presence-expiry.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.module';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceExpiry: PresenceExpiryService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;

    let redisStatus = 'connected';
    try {
      const pong = await this.redis.client.ping();
      if (pong !== 'PONG') {
        redisStatus = 'degraded';
      }
    } catch {
      redisStatus = 'disconnected';
      throw new ServiceUnavailableException({
        status: 'degraded',
        database: 'connected',
        redis: redisStatus,
      });
    }

    const activeAvailableUsers = await this.presenceExpiry.getActiveAvailableCount();

    return {
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        redis: redisStatus,
        activeAvailableUsers,
      },
    };
  }
}
