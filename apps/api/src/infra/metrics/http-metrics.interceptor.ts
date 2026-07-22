import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/** Records every HTTP request's duration/status into the Prometheus histogram. */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const start = process.hrtime.bigint();
    // Route pattern (e.g. "/orders/:id"), not the raw URL — keeps label
    // cardinality bounded regardless of how many distinct order ids are hit.
    const route = req.routeOptions?.url ?? req.url;

    return next.handle().pipe(
      tap({
        next: () => this.record(route, req.method, reply.statusCode, start),
        error: () => this.record(route, req.method, reply.statusCode || 500, start),
      }),
    );
  }

  private record(route: string, method: string, statusCode: number, start: bigint): void {
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    this.metrics.httpRequestDuration.observe({ method, route, status_code: statusCode }, seconds);
  }
}
