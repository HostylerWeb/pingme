import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { shouldRunWorkers } from '../common/utils/run-mode';
import { MatchesService } from './matches.service';

@Injectable()
export class MatchExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchExpiryService.name);
  private connection!: IORedis;
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly matches: MatchesService,
  ) {}

  onModuleInit() {
    if (!shouldRunWorkers()) {
      this.logger.log('Match expiry worker skipped (RUN_MODE=api)');
      return;
    }

    const redisUrl = this.config.get<string>('REDIS_URL', 'redis://localhost:6381');
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

    this.queue = new Queue('match-expiry', { connection: this.connection });

    this.worker = new Worker(
      'match-expiry',
      async () => {
        const expired = await this.matches.expirePendingMatches();
        if (expired > 0) {
          this.logger.log(`Expired ${expired} pending match(es)`);
        }
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

    this.logger.log('Match expiry worker started (every 60s)');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }
}
