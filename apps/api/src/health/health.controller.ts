import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.module';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
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

    return {
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        redis: redisStatus,
      },
    };
  }
}
