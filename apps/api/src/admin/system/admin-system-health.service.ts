import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRunMode, shouldRunWorkers } from '../../common/utils/run-mode';
import { NotificationQueueService } from '../../notifications/notification-queue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.module';

export type ServiceHealthStatus = 'ok' | 'degraded' | 'disabled' | 'error';

export interface ServiceHealthItem {
  id: string;
  label: string;
  status: ServiceHealthStatus;
  detail: string;
}

@Injectable()
export class AdminSystemHealthService {
  private readonly logger = new Logger(AdminSystemHealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly notificationQueue: NotificationQueueService,
  ) {}

  async getHealth() {
    const timestamp = new Date().toISOString();
    const runMode = getRunMode();
    const workersEnabled = shouldRunWorkers();

    const services: ServiceHealthItem[] = [
      {
        id: 'api',
        label: 'API process',
        status: 'ok',
        detail: `RUN_MODE=${runMode}`,
      },
      await this.checkDatabase(),
      await this.checkRedis(),
      await this.checkNotificationQueue(),
      this.checkPushDelivery(),
      ...this.checkBackgroundWorkers(),
      await this.checkOtaUpdates(),
    ];

    const overall = this.overallStatus(services);

    return {
      overall,
      timestamp,
      runMode,
      workersEnabled,
      services,
    };
  }

  private overallStatus(services: ServiceHealthItem[]): ServiceHealthStatus {
    if (services.some((s) => s.status === 'error')) return 'error';
    if (services.some((s) => s.status === 'degraded')) return 'degraded';
    if (services.every((s) => s.status === 'disabled' || s.status === 'ok')) return 'ok';
    return 'degraded';
  }

  private async checkDatabase(): Promise<ServiceHealthItem> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        id: 'database',
        label: 'PostgreSQL',
        status: 'ok',
        detail: 'Connected',
      };
    } catch (error) {
      return {
        id: 'database',
        label: 'PostgreSQL',
        status: 'error',
        detail: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealthItem> {
    try {
      const pong = await this.redis.client.ping();
      return {
        id: 'redis',
        label: 'Redis',
        status: pong === 'PONG' ? 'ok' : 'degraded',
        detail: pong === 'PONG' ? 'Connected' : `Unexpected response: ${pong}`,
      };
    } catch (error) {
      return {
        id: 'redis',
        label: 'Redis',
        status: 'error',
        detail: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  private async checkNotificationQueue(): Promise<ServiceHealthItem> {
    const queueHealth = await this.notificationQueue.getQueueHealth();
    const counts = queueHealth.counts;
    const countDetail = counts
      ? `waiting ${counts.waiting}, active ${counts.active}, failed ${counts.failed}`
      : 'Queue unavailable';

    if (queueHealth.status === 'disabled') {
      return {
        id: 'notification_queue',
        label: 'Push notification queue',
        status: 'disabled',
        detail: 'Worker disabled (RUN_MODE=api) — pushes enqueue but may not deliver',
      };
    }

    return {
      id: 'notification_queue',
      label: 'Push notification queue',
      status: queueHealth.status,
      detail: countDetail,
    };
  }

  private checkPushDelivery(): ServiceHealthItem {
    const enabled = this.config.get<string>('PUSH_ENABLED', 'false') === 'true';
    return {
      id: 'push_delivery',
      label: 'Expo push delivery',
      status: enabled ? 'ok' : 'disabled',
      detail: enabled ? 'PUSH_ENABLED=true' : 'PUSH_ENABLED=false — notifications log only',
    };
  }

  private checkBackgroundWorkers(): ServiceHealthItem[] {
    const workersEnabled = shouldRunWorkers();
    const workerNames = [
      'Notification worker',
      'Presence expiry',
      'Match expiry',
      'Icebreaker matching',
      'Icebreaker nearby push',
      'Events nearby push',
      'Account deletion',
      'Admin map refresh',
    ];

    return workerNames.map((name, index) => ({
      id: `worker_${index}`,
      label: name,
      status: workersEnabled ? 'ok' : 'disabled',
      detail: workersEnabled ? 'Expected to run in this process' : 'Skipped — use RUN_MODE=all or worker',
    }));
  }

  private async checkOtaUpdates(): Promise<ServiceHealthItem> {
    const otaUrl =
      this.config.get<string>('EXPO_OTA_URL') ??
      this.config.get<string>('OTA_MANIFEST_URL') ??
      'https://pingme.hostyler.cloud/ota/manifest';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(otaUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return {
          id: 'ota_updates',
          label: 'OTA updates (xprem)',
          status: 'degraded',
          detail: `HTTP ${response.status} from ${otaUrl}`,
        };
      }

      return {
        id: 'ota_updates',
        label: 'OTA updates (xprem)',
        status: 'ok',
        detail: `Manifest reachable (${otaUrl})`,
      };
    } catch (error) {
      this.logger.warn(`OTA health check failed: ${error instanceof Error ? error.message : error}`);
      return {
        id: 'ota_updates',
        label: 'OTA updates (xprem)',
        status: 'error',
        detail: error instanceof Error ? error.message : 'Manifest unreachable',
      };
    }
  }
}
