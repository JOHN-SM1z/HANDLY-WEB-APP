import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/auth/decorators';
import { PrismaService } from '../infra/prisma/prisma.service';
import { RedisService } from '../infra/redis/redis.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    const db = await this.prisma
      .$queryRaw`SELECT 1`.then(() => 'up')
      .catch(() => 'down');
    let redis = 'down';
    try {
      redis = (await this.redis.client.ping()) === 'PONG' ? 'up' : 'down';
    } catch {
      redis = 'down';
    }
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      redis,
      time: new Date().toISOString(),
    };
  }
}
