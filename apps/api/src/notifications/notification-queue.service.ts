import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PushPayload } from './notification.service';
import { PushSenderService } from './push-sender.service';

interface PushJobData extends PushPayload {
  userId: string;
}

@Injectable()
export class NotificationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueueService.name);
  private connection!: IORedis;
  private queue!: Queue<PushJobData>;
  private worker!: Worker<PushJobData>;

  constructor(
    private readonly config: ConfigService,
    private readonly pushSender: PushSenderService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL', 'redis://localhost:6381');
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

    this.queue = new Queue<PushJobData>('notifications', { connection: this.connection });

    this.worker = new Worker<PushJobData>(
      'notifications',
      async (job: Job<PushJobData>) => {
        const { userId, ...payload } = job.data;
        await this.pushSender.deliver(userId, payload);
      },
      { connection: this.connection },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Push job ${job?.id} failed: ${error.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  async enqueuePush(data: PushJobData) {
    await this.queue.add('push', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }
}
