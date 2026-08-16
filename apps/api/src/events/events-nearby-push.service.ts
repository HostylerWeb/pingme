import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
export class EventsNearbyPushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsNearbyPushService.name);
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
    this.queue = new Queue<FlushJobData>('events-nearby-push', {
      connection: this.connection,
    });

    if (!shouldRunWorkers()) {
      this.logger.log('Events nearby push worker skipped (RUN_MODE=api)');
      return;
    }

    this.worker = new Worker<FlushJobData>(
      'events-nearby-push',
      async (job: Job<FlushJobData>) => {
        await this.flushRecipient(job.data.recipientId);
      },
      { connection: this.connection },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Events nearby push job ${job?.id} failed: ${error.message}`);
    });

    this.logger.log('Events nearby push worker started');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async notifyNearbyUsersOnCreate(
    hostUserId: string,
    eventId: string,
    title: string,
    latitude: number,
    longitude: number,
  ) {
    const recipientIds = await this.findNearbyRecipientIds(
      hostUserId,
      latitude,
      longitude,
    );
    if (recipientIds.length === 0) {
      return;
    }

    await Promise.all(
      recipientIds.map((recipientId) =>
        this.scheduleAggregatedAlert(recipientId, eventId, title),
      ),
    );
  }

  private batchKey(recipientId: string) {
    return `events:nearby:batch:${recipientId}`;
  }

  private jobId(recipientId: string) {
    return `events-nearby-${recipientId}`;
  }

  private async scheduleAggregatedAlert(
    recipientId: string,
    eventId: string,
    title: string,
  ) {
    const key = this.batchKey(recipientId);
    await this.connection.hset(key, eventId, title);
    await this.connection.expire(key, BATCH_TTL_SECONDS);

    if (!shouldRunWorkers()) {
      await this.sendAggregatedPush(recipientId);
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
    const count = await this.connection.hlen(key);
    if (count === 0) {
      return;
    }

    await this.sendAggregatedPush(recipientId);
    await this.connection.del(key);
  }

  private async sendAggregatedPush(recipientId: string) {
    const key = this.batchKey(recipientId);
    const entries = await this.connection.hgetall(key);
    const eventIds = Object.keys(entries);
    if (eventIds.length === 0) {
      return;
    }

    const firstEventId = eventIds[0];
    const firstTitle = entries[firstEventId] ?? 'New event';

    const title =
      eventIds.length === 1
        ? `New event near you: ${firstTitle}`
        : `${eventIds.length} new events near you`;
    const body = eventIds.length === 1 ? 'Tap to see details and RSVP.' : 'Tap to browse nearby events.';

    await this.notifications.sendToUser(recipientId, {
      type: NOTIFICATION_TYPES.EVENT_NEARBY,
      title,
      body,
      data: {
        type: NOTIFICATION_TYPES.EVENT_NEARBY,
        eventId: firstEventId,
        count: String(eventIds.length),
      },
    });
  }

  private async findNearbyRecipientIds(
    hostUserId: string,
    latitude: number,
    longitude: number,
  ): Promise<string[]> {
    const radius = this.appConfig.getDistanceConfig().events.discoveryRadiusMeters;
    const blockedByHost = await this.blocks.getBlockedUserIds(hostUserId);

    const rows = await this.prisma.$queryRaw<{ user_id: string }[]>`
      SELECT ps.user_id
      FROM presence_sessions ps
      INNER JOIN user_settings us ON us.user_id = ps.user_id
      INNER JOIN devices d ON d.user_id = ps.user_id
      INNER JOIN users u ON u.id = ps.user_id
        AND u.deleted_at IS NULL
        AND u.status <> 'deleted'
      WHERE ps.latitude IS NOT NULL
        AND ps.longitude IS NOT NULL
        AND ps.user_id <> ${hostUserId}::uuid
        AND us.allow_push_events_nearby = true
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(ps.longitude, ps.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
          ${radius}
        )
      GROUP BY ps.user_id
      LIMIT 200
    `;

    const eligible: string[] = [];
    for (const row of rows) {
      if (blockedByHost.includes(row.user_id)) {
        continue;
      }
      const blocked = await this.blocks.getBlockedUserIds(row.user_id);
      if (blocked.includes(hostUserId)) {
        continue;
      }
      eligible.push(row.user_id);
    }

    return eligible;
  }
}
