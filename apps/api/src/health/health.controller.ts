import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PresenceExpiryService } from '../presence/presence-expiry.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceExpiry: PresenceExpiryService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    const activeAvailableUsers = await this.presenceExpiry.getActiveAvailableCount();

    return {
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        activeAvailableUsers,
      },
    };
  }
}
