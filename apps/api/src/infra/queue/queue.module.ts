import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';
import { DISPATCH_QUEUE_NAME } from './queue.constants';

export const BULLMQ_CONNECTION = Symbol('BULLMQ_CONNECTION');
export const DISPATCH_QUEUE = Symbol('DISPATCH_QUEUE');

/**
 * BullMQ needs its own Redis connection with maxRetriesPerRequest: null (the
 * shared RedisService.client caps retries for the OTP rate-limit use case,
 * which is wrong for a queue). One queue for M3 — "dispatch" — more can join
 * this module later without touching callers.
 */
@Global()
@Module({
  imports: [RedisModule],
  providers: [
    {
      provide: BULLMQ_CONNECTION,
      useFactory: (redis: RedisService): Redis =>
        redis.client.duplicate({ maxRetriesPerRequest: null, enableOfflineQueue: true, lazyConnect: false }),
      inject: [RedisService],
    },
    {
      provide: DISPATCH_QUEUE,
      useFactory: (connection: Redis): Queue =>
        new Queue(DISPATCH_QUEUE_NAME, {
          connection,
          defaultJobOptions: {
            removeOnComplete: 500,
            removeOnFail: 1000,
            // Batch 3 reliability fix: a transient Redis/DB blip used to drop an
            // offer-expiry job permanently (no retry existed at all). Bounded
            // exponential backoff — each job is also idempotent on the DB side
            // (handleOfferExpiry no-ops if the dispatch already moved on), so a
            // retry can never double-cascade.
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          },
        }),
      inject: [BULLMQ_CONNECTION],
    },
  ],
  exports: [BULLMQ_CONNECTION, DISPATCH_QUEUE],
})
export class QueueModule implements OnModuleDestroy {
  constructor(
    @Inject(DISPATCH_QUEUE) private readonly dispatchQueue: Queue,
    @Inject(BULLMQ_CONNECTION) private readonly connection: Redis,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.dispatchQueue.close().catch(() => undefined);
    await this.connection.quit().catch(() => undefined);
  }
}
