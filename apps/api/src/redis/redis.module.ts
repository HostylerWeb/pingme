import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get<string>('REDIS_URL', 'redis://localhost:6381'));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}

/** Shared BullMQ-compatible Redis connection (maxRetriesPerRequest: null). */
@Injectable()
export class BullmqRedisService implements OnModuleDestroy {
  readonly connection: Redis;

  constructor(config: ConfigService) {
    this.connection = new Redis(config.get<string>('REDIS_URL', 'redis://localhost:6381'), {
      maxRetriesPerRequest: null,
    });
  }

  async onModuleDestroy() {
    await this.connection.quit();
  }
}

@Global()
@Module({
  providers: [RedisService, BullmqRedisService],
  exports: [RedisService, BullmqRedisService],
})
export class RedisModule {}
