import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { shouldRunWorkers } from '../common/utils/run-mode';
import { BullmqRedisService } from '../redis/redis.module';
import { IcebreakerService } from './icebreaker.service';

@Injectable()
export class IcebreakerMatchingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IcebreakerMatchingService.name);
  private connection!: IORedis;
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly bullmqRedis: BullmqRedisService,
    private readonly icebreaker: IcebreakerService,
  ) {}

  onModuleInit() {
    if (!shouldRunWorkers()) {
      this.logger.log('Icebreaker matching worker skipped (RUN_MODE=api)');
      return;
    }

    this.connection = this.bullmqRedis.connection;

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
  }
}
