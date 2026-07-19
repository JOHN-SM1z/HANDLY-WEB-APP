import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

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
    } else if (exception instanceof Error) {
      detail = exception.message;
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${detail ?? title}`,
        exception instanceof Error ? exception.stack : undefined,
      );
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
