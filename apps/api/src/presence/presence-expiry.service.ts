import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { ChatGateway } from '../chat/chat.gateway';
import { shouldRunWorkers } from '../common/utils/run-mode';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { BullmqRedisService, RedisService } from '../redis/redis.module';

const GEO_AVAILABLE_KEY = 'geo:available';

@Injectable()
export class PresenceExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PresenceExpiryService.name);
  private connection!: IORedis;
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly bullmqRedis: BullmqRedisService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly appConfig: AppConfigService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly gateway: ChatGateway,
  ) {}

  onModuleInit() {
    if (!shouldRunWorkers()) {
      this.logger.log('Presence expiry worker skipped (RUN_MODE=api)');
      return;
    }

    this.connection = this.bullmqRedis.connection;

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
  }

  async expireStaleSessions() {
    const presenceTtlSeconds = this.appConfig.getPresenceTtlSeconds();
    const cutoff = new Date(Date.now() - presenceTtlSeconds * 1000);

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
        latitude: null,
        longitude: null,
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
    for (const session of staleSessions) {
      this.gateway.emitPresenceUpdated(session.userId, { isAvailable: false });
    }
  }

  async getActiveAvailableCount() {
    return this.redis.client.zcard(GEO_AVAILABLE_KEY);
  }
}
