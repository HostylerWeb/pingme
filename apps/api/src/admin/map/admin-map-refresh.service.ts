import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { shouldRunWorkers } from '../../common/utils/run-mode';
import { BullmqRedisService } from '../../redis/redis.module';
import { ADMIN_MAP_REFRESH_INTERVAL_MS } from './admin-map.constants';
import { AdminMapService } from './admin-map.service';

@Injectable()
export class AdminMapRefreshService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminMapRefreshService.name);
  private connection!: IORedis;
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly bullmqRedis: BullmqRedisService,
    private readonly adminMap: AdminMapService,
  ) {}

  onModuleInit() {
    if (!shouldRunWorkers()) {
      this.logger.log('Admin map refresh worker skipped (RUN_MODE=api)');
      return;
    }

    this.connection = this.bullmqRedis.connection;
    this.queue = new Queue('admin-map-refresh', { connection: this.connection });

    this.worker = new Worker(
      'admin-map-refresh',
      async () => {
        if (!(await this.adminMap.isMapBeingWatched())) {
          return;
        }

        const snapshot = await this.adminMap.refreshHeatmapCache();
        this.logger.debug(
          `Admin map refreshed: online=${snapshot.totalActive} clusters=${snapshot.cells.length}`,
        );
      },
      { connection: this.connection },
    );

    void this.queue.add(
      'tick',
      {},
      {
        repeat: { every: ADMIN_MAP_REFRESH_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.logger.log(
      `Admin map refresh worker started (every ${ADMIN_MAP_REFRESH_INTERVAL_MS / 1000}s, only while map page is open)`,
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
