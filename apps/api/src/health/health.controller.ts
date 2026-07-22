import { access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Controller, Get, HttpCode, Inject } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Public } from '../common/auth/decorators';
import { AppConfig } from '../infra/config/app-config';
import { DISPATCH_QUEUE } from '../infra/queue/queue.module';
import { PrismaService } from '../infra/prisma/prisma.service';
import { RedisService } from '../infra/redis/redis.service';

type CheckStatus = 'up' | 'down';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: AppConfig,
    @Inject(DISPATCH_QUEUE) private readonly dispatchQueue: Queue,
  ) {}

  /** Back-compat summary — kept for existing dashboards/scripts that already poll this shape. */
  @Get()
  async check() {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
    return { status: db === 'up' ? 'ok' : 'degraded', db, redis, time: new Date().toISOString() };
  }

  /**
   * Liveness — "is the process itself still able to respond at all."
   * Deliberately checks NOTHING external: a database outage should not make
   * an orchestrator kill and restart otherwise-healthy API pods (that would
   * just thrash every pod in lockstep during a DB blip). Restart decisions
   * belong on this endpoint; traffic-routing decisions belong on /ready below.
   */
  @Get('live')
  @HttpCode(200)
  live() {
    return { status: 'ok', time: new Date().toISOString() };
  }

  /**
   * Readiness — "is this instance ready to receive traffic right now."
   * Checks every real dependency; a load balancer/orchestrator should stop
   * routing to this instance (not necessarily restart it) if this fails.
   */
  @Get('ready')
  async ready() {
    const [db, redis, queue, storage] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
      this.checkQueue(),
      this.checkStorage(),
    ]);
    const checks = { db, redis, queue, storage };
    const allUp = Object.values(checks).every((c) => c === 'up');
    return { status: allUp ? 'ok' : 'not_ready', checks, time: new Date().toISOString() };
  }

  private async checkDb(): Promise<CheckStatus> {
    return this.prisma
      .$queryRaw`SELECT 1`.then(() => 'up' as const)
      .catch(() => 'down' as const);
  }

  private async checkRedis(): Promise<CheckStatus> {
    try {
      return (await this.redis.client.ping()) === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }

  private async checkQueue(): Promise<CheckStatus> {
    try {
      // getJobCounts round-trips through the queue's own Redis connection —
      // a real check of the BullMQ connection, not just "the class exists."
      await this.dispatchQueue.getJobCounts('waiting');
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkStorage(): Promise<CheckStatus> {
    try {
      // Directory exists and is writable — LocalDiskStorage's actual
      // requirement. Same UPLOAD_DIR resolution LocalDiskStorage itself uses.
      await access(resolve(process.cwd(), this.config.env.UPLOAD_DIR), constants.W_OK);
      return 'up';
    } catch {
      return 'down';
    }
  }
}
