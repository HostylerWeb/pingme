import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { shouldRunWorkers } from '../common/utils/run-mode';
import { BullmqRedisService } from '../redis/redis.module';
import { UsersService } from './users.service';

@Injectable()
export class AccountDeletionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountDeletionService.name);
  private connection!: IORedis;
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly bullmqRedis: BullmqRedisService,
    private readonly users: UsersService,
  ) {}

  onModuleInit() {
    if (!shouldRunWorkers()) {
      this.logger.log('Account deletion worker skipped (RUN_MODE=api)');
      return;
    }

    this.connection = this.bullmqRedis.connection;
    this.queue = new Queue('account-deletion', { connection: this.connection });

    this.worker = new Worker(
      'account-deletion',
      async () => {
        const count = await this.users.finalizeScheduledDeletions();
        if (count > 0) {
          this.logger.log(`Finalized ${count} scheduled account deletion(s)`);
        }
      },
      { connection: this.connection },
    );

    void this.queue.add(
      'tick',
      {},
      {
        repeat: { every: 60 * 60 * 1000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.logger.log('Account deletion worker started (every 60m)');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
