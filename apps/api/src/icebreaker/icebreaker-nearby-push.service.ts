import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@pingme/db';
import { NOTIFICATION_TYPES } from '@pingme/shared';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { BlocksService } from '../common/services/blocks.service';
import { AppConfigService } from '../config/app-config.service';
import { shouldRunWorkers } from '../common/utils/run-mode';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { BullmqRedisService } from '../redis/redis.module';

const BATCH_DELAY_MS = 45_000;
const BATCH_TTL_SECONDS = 300;

interface FlushJobData {
  recipientId: string;
}

@Injectable()
export class IcebreakerNearbyPushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IcebreakerNearbyPushService.name);
  private connection!: IORedis;
  private queue!: Queue<FlushJobData>;
  private worker!: Worker<FlushJobData>;

  constructor(
    private readonly bullmqRedis: BullmqRedisService,
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
    private readonly blocks: BlocksService,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit() {
    this.connection = this.bullmqRedis.connection;
    this.queue = new Queue<FlushJobData>('icebreaker-nearby-push', {
      connection: this.connection,
    });

    if (!shouldRunWorkers()) {
      this.logger.log('Icebreaker nearby push worker skipped (RUN_MODE=api)');
      return;
    }

    this.worker = new Worker<FlushJobData>(
      'icebreaker-nearby-push',
      async (job: Job<FlushJobData>) => {
        await this.flushRecipient(job.data.recipientId);
      },
      { connection: this.connection },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Icebreaker nearby push job ${job?.id} failed: ${error.message}`);
    });

    this.logger.log('Icebreaker nearby push worker started');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async notifyNearbyUsersOnStart(
    starterUserId: string,
    sessionId: string,
    latitude: number,
    longitude: number,
  ) {
    const recipientIds = await this.findNearbyRecipientIds(starterUserId, latitude, longitude);
    if (recipientIds.length === 0) {
      return;
    }

    await Promise.all(
      recipientIds.map((recipientId) =>
        this.scheduleAggregatedAlert(recipientId, starterUserId, sessionId),
      ),
    );
  }

  private batchKey(recipientId: string) {
    return `icebreaker:nearby:batch:${recipientId}`;
  }

  private jobId(recipientId: string) {
    return `icebreaker-nearby-${recipientId}`;
  }

  private async scheduleAggregatedAlert(
    recipientId: string,
    starterUserId: string,
    sessionId: string,
  ) {
    const key = this.batchKey(recipientId);
    await this.connection.sadd(key, starterUserId);
    await this.connection.expire(key, BATCH_TTL_SECONDS);

    if (!shouldRunWorkers()) {
      const count = await this.connection.scard(key);
      await this.sendAggregatedPush(recipientId, Number(count), sessionId);
      await this.connection.del(key);
      return;
    }

    const existing = await this.queue.getJob(this.jobId(recipientId));
    if (existing) {
      await existing.remove();
    }

    await this.queue.add(
      'flush',
      { recipientId },
      {
        jobId: this.jobId(recipientId),
        delay: BATCH_DELAY_MS,
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
  }

  private async flushRecipient(recipientId: string) {
    const key = this.batchKey(recipientId);
    const count = await this.connection.scard(key);
    if (count === 0) {
      return;
    }

    await this.connection.del(key);
    await this.sendAggregatedPush(recipientId, Number(count));
  }

  private async sendAggregatedPush(
    recipientId: string,
    count: number,
    sessionId?: string,
  ) {
    if (count <= 0) {
      return;
    }

    const title =
      count === 1
        ? '1 person nearby has Break the ice on'
        : `${count} people nearby have Break the ice on`;
    const body = "Turn on to browse who's open.";

    await this.notifications.sendToUser(recipientId, {
      type: NOTIFICATION_TYPES.ICEBREAKER_NEARBY,
      title,
      body,
      data: {
        type: NOTIFICATION_TYPES.ICEBREAKER_NEARBY,
        count: String(count),
        ...(sessionId ? { sessionId } : {}),
      },
    });
  }

  private async findNearbyRecipientIds(
    starterUserId: string,
    latitude: number,
    longitude: number,
  ) {
    const radius = this.appConfig.getDistanceConfig().icebreaker.radiusMeters;
    const presenceTtlSeconds = this.appConfig.getPresenceTtlSeconds();
    const locationCutoff = new Date(Date.now() - presenceTtlSeconds * 1000);
    const blockedIds = await this.blocks.getBlockedUserIds(starterUserId);
    const blockedFilter =
      blockedIds.length > 0
        ? Prisma.sql`AND ps.user_id NOT IN (${Prisma.join(
            blockedIds.map((id) => Prisma.sql`${id}::uuid`),
          )})`
        : Prisma.empty;

    const rows = await this.prisma.$queryRaw<{ user_id: string }[]>`
      SELECT ps.user_id
      FROM presence_sessions ps
      INNER JOIN users u ON u.id = ps.user_id
      INNER JOIN user_settings us ON us.user_id = ps.user_id
      WHERE ps.user_id != ${starterUserId}::uuid
        AND u.deleted_at IS NULL
        AND u.status <> 'deleted'
        AND ps.latitude IS NOT NULL
        AND ps.longitude IS NOT NULL
        AND ps.location_updated_at >= ${locationCutoff}
        AND us.allow_push_icebreaker_nearby = true
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(ps.longitude, ps.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
          ${radius}
        )
        ${blockedFilter}
      LIMIT 100
    `;

    return rows.map((row) => row.user_id);
  }
}
