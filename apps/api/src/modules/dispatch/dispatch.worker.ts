import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import type Redis from 'ioredis';
import { captureError } from '../../infra/monitoring/error-monitoring';
import { BULLMQ_CONNECTION } from '../../infra/queue/queue.module';
import { DISPATCH_QUEUE_NAME, DispatchJobName, type OfferExpiryJobData } from '../../infra/queue/queue.constants';
import { DispatchService } from './dispatch.service';

/**
 * Processes the "dispatch" queue — one worker, matching ARCHITECTURE's W1
 * ("dispatch cascade and offer expiry"). Only offer-expiry is ever actually
 * enqueued today (cascadeNext's other call sites run inline from the
 * triggering request); the job name switch is here so a future zero-delay
 * "cascade-next" job can join without restructuring the worker.
 */
@Injectable()
export class DispatchWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DispatchWorker.name);
  private worker?: Worker;

  constructor(
    @Inject(BULLMQ_CONNECTION) private readonly connection: Redis,
    private readonly dispatch: DispatchService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      DISPATCH_QUEUE_NAME,
      async (job: Job) => {
        switch (job.name) {
          case DispatchJobName.OFFER_EXPIRY: {
            const { dispatchId } = job.data as OfferExpiryJobData;
            await this.dispatch.handleOfferExpiry(dispatchId);
            return;
          }
          default:
            this.logger.warn(`Unknown dispatch job name: ${job.name}`);
        }
      },
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Dispatch job ${job?.id} (${job?.name}) failed: ${err.message}`);
      // Only reported once BullMQ's own retries (queue.module.ts) are
      // exhausted for this job — a mid-retry failure isn't yet an incident.
      if (!job || job.attemptsMade >= (job.opts.attempts ?? 1)) {
        captureError(err, { jobId: job?.id, jobName: job?.name, queue: DISPATCH_QUEUE_NAME });
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
