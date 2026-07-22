import { Inject, Injectable, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import * as client from 'prom-client';
import { DISPATCH_QUEUE } from '../queue/queue.module';

/**
 * Central Prometheus registry (Batch 4). One registry, one `/metrics`
 * endpoint (metrics.controller.ts) — the standard single-registry pattern,
 * not a metrics-per-module design, so a scrape sees everything in one pass.
 */
@Injectable()
export class MetricsService {
  readonly registry = new client.Registry();

  readonly httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [this.registry],
  });

  readonly dbQueryDuration = new client.Histogram({
    name: 'db_query_duration_seconds',
    help: 'Prisma query duration in seconds',
    labelNames: ['model', 'action'],
    buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
    registers: [this.registry],
  });

  readonly queueDepth = new client.Gauge({
    name: 'bullmq_queue_depth',
    help: 'Number of jobs in each BullMQ queue state',
    labelNames: ['queue', 'state'],
    registers: [this.registry],
  });

  readonly socketConnections = new client.Gauge({
    name: 'socketio_connections',
    help: 'Currently connected Socket.IO clients',
    registers: [this.registry],
  });

  constructor(@Optional() @Inject(DISPATCH_QUEUE) private readonly dispatchQueue?: Queue) {
    client.collectDefaultMetrics({ register: this.registry });
  }

  /** Refreshed on-demand at scrape time (not a background timer) — a Prometheus scrape is itself the trigger. */
  async refreshQueueDepth(): Promise<void> {
    if (!this.dispatchQueue) return;
    const counts = await this.dispatchQueue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
    for (const [state, count] of Object.entries(counts)) {
      this.queueDepth.set({ queue: this.dispatchQueue.name, state }, count);
    }
  }

  async getMetrics(): Promise<string> {
    await this.refreshQueueDepth();
    return this.registry.metrics();
  }
}
