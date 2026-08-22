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
    const workersInProcess = shouldRunWorkers();
    const workerProcessSplit = runMode === 'api';

    const services: ServiceHealthItem[] = [
      {
        id: 'api',
        label: 'API process',
        status: 'ok',
        detail: workerProcessSplit
          ? `RUN_MODE=${runMode} (background jobs run in pingme-worker)`
          : `RUN_MODE=${runMode}`,
      },
      await this.checkDatabase(),
      await this.checkRedis(),
      await this.checkNotificationQueue(runMode),
      this.checkPushDelivery(),
      ...this.checkBackgroundWorkers(runMode),
      await this.checkOtaUpdates(),
    ];

    const overall = this.overallStatus(services);

    return {
      overall,
      timestamp,
      runMode,
      workersEnabled: workersInProcess,
      workerProcessSplit,
      services,
    };
  }

  private overallStatus(services: ServiceHealthItem[]): ServiceHealthStatus {
    if (services.some((s) => s.status === 'error')) return 'error';
    if (services.some((s) => s.status === 'degraded')) return 'degraded';
    if (services.every((s) => s.status === 'disabled' || s.status === 'ok')) return 'ok';
    return 'degraded';
  }

  private async fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private resolveOtaBaseUrl(): string {
    const raw =
      this.config.get<string>('EXPO_OTA_URL') ??
      this.config.get<string>('OTA_MANIFEST_URL') ??
      'https://pingme.hostyler.cloud/ota';
    const trimmed = raw.replace(/\/$/, '');
    return trimmed.endsWith('/manifest') ? trimmed.slice(0, -'/manifest'.length) : trimmed;
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

  private formatQueueCounts(
    counts: {
      active: number;
      waiting: number;
      delayed: number;
      failed: number;
      completed: number;
    },
  ) {
    return `waiting ${counts.waiting}, active ${counts.active}, failed ${counts.failed}`;
  }

  private async checkNotificationQueue(runMode: ReturnType<typeof getRunMode>): Promise<ServiceHealthItem> {
    const queueHealth = await this.notificationQueue.getQueueHealth();
    const counts = queueHealth.counts;
    const countDetail = counts ? this.formatQueueCounts(counts) : 'Queue unavailable';

    if (queueHealth.status === 'disabled' && runMode === 'api' && counts) {
      const failed = counts.failed ?? 0;
      return {
        id: 'notification_queue',
        label: 'Push notification queue',
        status: failed > 25 ? 'degraded' : 'ok',
        detail: `Processed by pingme-worker — ${countDetail}`,
      };
    }

    if (queueHealth.status === 'disabled') {
      return {
        id: 'notification_queue',
        label: 'Push notification queue',
        status: 'disabled',
        detail: 'Worker not running in this process',
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

  private checkBackgroundWorkers(runMode: ReturnType<typeof getRunMode>): ServiceHealthItem[] {
    const workersInProcess = shouldRunWorkers();
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
      status: workersInProcess || runMode === 'api' ? 'ok' : 'disabled',
      detail: workersInProcess
        ? 'Runs in this process'
        : runMode === 'api'
          ? 'Runs in pingme-worker service'
          : 'Skipped — set RUN_MODE=worker or all',
    }));
  }

  private async checkOtaUpdates(): Promise<ServiceHealthItem> {
    const otaBase = this.resolveOtaBaseUrl();
    const hcUrl = `${otaBase}/hc`;
    const manifestUrl = `${otaBase}/manifest`;

    try {
      const hcResponse = await this.fetchWithTimeout(hcUrl, { method: 'GET' });
      if (!hcResponse.ok) {
        return {
          id: 'ota_updates',
          label: 'OTA updates (xprem)',
          status: 'degraded',
          detail: `Health check HTTP ${hcResponse.status} from ${hcUrl}`,
        };
      }

      const appId = this.config.get<string>('EXPO_OTA_APP_ID');
      if (!appId) {
        return {
          id: 'ota_updates',
          label: 'OTA updates (xprem)',
          status: 'ok',
          detail: `OTA server reachable (${hcUrl}) — set EXPO_OTA_APP_ID to verify manifest`,
        };
      }

      const channel = this.config.get<string>('EXPO_OTA_CHANNEL') ?? 'staging';
      const runtimeVersion =
        this.config.get<string>('EXPO_OTA_RUNTIME_VERSION') ??
        this.config.get<string>('OTA_HEALTH_RUNTIME_VERSION') ??
        '0.1.0';

      const manifestResponse = await this.fetchWithTimeout(manifestUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'expo-app-id': appId,
          'expo-channel-name': channel,
          'expo-runtime-version': runtimeVersion,
          'expo-platform': 'android',
          'expo-protocol-version': '1',
        },
      });

      if (!manifestResponse.ok) {
        return {
          id: 'ota_updates',
          label: 'OTA updates (xprem)',
          status: 'degraded',
          detail: `Manifest HTTP ${manifestResponse.status} (HC ok) — ${manifestUrl}`,
        };
      }

      return {
        id: 'ota_updates',
        label: 'OTA updates (xprem)',
        status: 'ok',
        detail: `Manifest reachable (${manifestUrl}, channel ${channel})`,
      };
    } catch (error) {
      this.logger.warn(`OTA health check failed: ${error instanceof Error ? error.message : error}`);
      return {
        id: 'ota_updates',
        label: 'OTA updates (xprem)',
        status: 'error',
        detail: error instanceof Error ? error.message : 'OTA server unreachable',
      };
    }
  }
}
