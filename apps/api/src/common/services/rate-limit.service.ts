import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.module';

const INCREMENT_WITH_EXPIRE_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

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
    const count = (await this.redis.client.eval(
      INCREMENT_WITH_EXPIRE_LUA,
      1,
      key,
      String(windowSeconds),
    )) as number;
    return count <= limit;
  }
}
