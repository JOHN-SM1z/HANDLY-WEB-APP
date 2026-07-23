import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { captureError } from '../../infra/monitoring/error-monitoring';

interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Array<{ path: string; message: string }>;
}

/**
 * Maps every thrown error to an RFC 9457 problem+json response.
 * Validation errors (from ZodValidationPipe) carry a structured `errors` array.
 */
@Catch()
export class ProblemExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail: string | undefined;
    let errors: ProblemBody['errors'];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        title = res;
      } else if (res && typeof res === 'object') {
        const obj = res as Record<string, unknown>;
        title = (obj.error as string) ?? httpTitle(status);
        detail = Array.isArray(obj.message)
          ? (obj.message as string[]).join('; ')
          : (obj.message as string | undefined);
        if (Array.isArray(obj.errors)) {
          errors = obj.errors as ProblemBody['errors'];
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2002') {
      // A unique-constraint violation reaching this far means a DB-level
      // guard caught a race that an application-level pre-check missed
      // (e.g. two concurrent creates for the same unique row) — a benign,
      // expected conflict, not an unexpected server error. Report it as a
      // clean 409 instead of falling through to the generic 500 branch
      // below, and skip Sentry (nothing actionable — the constraint did its
      // job).
      status = HttpStatus.CONFLICT;
      title = 'Conflict';
      detail = 'Bu amal allaqachon bajarilgan';
    } else if (exception instanceof Error) {
      detail = exception.message;
      // Fastify plugins (e.g. @fastify/rate-limit) throw a plain Error with a
      // `statusCode` property rather than a NestJS HttpException — recognize
      // that convention so a 429/413/etc. from below Nest's routing layer
      // doesn't get flattened into a misleading 500. Confirmed live: without
      // this, a rate-limited request returned 500 (and got sent to error
      // monitoring as an "unexpected" server error) instead of 429.
      const withStatus = exception as Error & { statusCode?: unknown };
      if (typeof withStatus.statusCode === 'number' && withStatus.statusCode >= 400 && withStatus.statusCode < 600) {
        status = withStatus.statusCode;
        title = httpTitle(status);
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${detail ?? title}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      // Only genuinely unexpected (5xx) errors go to error monitoring — a
      // no-op when SENTRY_DSN is unset (dev/test/CI need no credentials).
      captureError(exception, { method: request.method, url: request.url });
      // Never leak internal details to clients.
      detail = undefined;
      title = 'Internal Server Error';
    }

    const body: ProblemBody = {
      type: 'about:blank',
      title,
      status,
      ...(detail ? { detail } : {}),
      ...(errors ? { errors } : {}),
      instance: request.url,
    };

    void reply.status(status).header('content-type', 'application/problem+json').send(body);
  }
}

function httpTitle(status: number): string {
  return HttpStatus[status] ? String(HttpStatus[status]).replace(/_/g, ' ') : 'Error';
}
