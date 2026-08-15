import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PRESENCE_TTL_SECONDS } from '@pingme/shared';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { shouldRunWorkers } from '../common/utils/run-mode';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.module';

const GEO_AVAILABLE_KEY = 'geo:available';

@Injectable()
export class PresenceExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PresenceExpiryService.name);
  private connection!: IORedis;
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit() {
    if (!shouldRunWorkers()) {
      this.logger.log('Presence expiry worker skipped (RUN_MODE=api)');
      return;
    }

    const redisUrl = this.config.get<string>('REDIS_URL', 'redis://localhost:6381');
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

    this.queue = new Queue('presence-expiry', { connection: this.connection });

    this.worker = new Worker(
      'presence-expiry',
      async () => {
        await this.expireStaleSessions();
      },
      { connection: this.connection },
    );

    void this.queue.add(
      'tick',
      {},
      {
        repeat: { every: 60_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.logger.log('Presence expiry worker started (every 60s)');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  async expireStaleSessions() {
    const cutoff = new Date(Date.now() - PRESENCE_TTL_SECONDS * 1000);

    const staleSessions = await this.prisma.presenceSession.findMany({
      where: {
        isActive: true,
        OR: [{ locationUpdatedAt: { lt: cutoff } }, { locationUpdatedAt: null }],
      },
      select: { userId: true },
    });

    if (staleSessions.length === 0) return;

    for (const session of staleSessions) {
      await this.redis.client.zrem(GEO_AVAILABLE_KEY, session.userId);
      await this.redis.client.del(`presence:${session.userId}`);
    }

    await this.prisma.presenceSession.updateMany({
      where: {
        userId: { in: staleSessions.map((session) => session.userId) },
      },
      data: {
        isActive: false,
        endedAt: new Date(),
      },
    });

    await this.prisma.user.updateMany({
      where: {
        id: { in: staleSessions.map((session) => session.userId) },
        isAvailable: true,
      },
      data: { isAvailable: false },
    });

    this.logger.log(`Expired ${staleSessions.length} stale presence session(s)`);
  }

  async getActiveAvailableCount() {
    return this.redis.client.zcard(GEO_AVAILABLE_KEY);
  }
}
