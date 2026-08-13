import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.module';

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async checkLimit(key: string, ttlSeconds: number): Promise<boolean> {
    const exists = await this.redis.client.get(key);
    if (exists) return false;
    await this.redis.client.set(key, '1', 'EX', ttlSeconds);
    return true;
  }

  async incrementWithinWindow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const count = await this.redis.client.incr(key);
    if (count === 1) {
      await this.redis.client.expire(key, windowSeconds);
    }
    return count <= limit;
  }
}
