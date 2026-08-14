import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { IcebreakerService } from './icebreaker.service';

@Injectable()
export class IcebreakerMatchingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IcebreakerMatchingService.name);
  private connection!: IORedis;
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly icebreaker: IcebreakerService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL', 'redis://localhost:6381');
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

    this.queue = new Queue('icebreaker-matching', { connection: this.connection });

    this.worker = new Worker(
      'icebreaker-matching',
      async () => {
        const expiredSessions = await this.icebreaker.expireSessions();
        const expiredInterests = await this.icebreaker.expireInterests();
        if (expiredSessions > 0 || expiredInterests > 0) {
          this.logger.log(
            `Icebreaker tick: expiredSessions=${expiredSessions} expiredInterests=${expiredInterests}`,
          );
        }
      },
      { connection: this.connection },
    );

    void this.queue.add(
      'tick',
      {},
      {
        repeat: { every: 30_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.logger.log('Icebreaker matching worker started (every 30s)');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }
}
