import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validate + parse a request payload against a Zod schema.
 * Usage: `@Body(new ZodValidationPipe(registerSchema)) dto: RegisterInput`.
 * The same schemas power the web client, so client and server agree on "valid".
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: 'Validation failed',
        message: "Ma'lumotlar noto'g'ri",
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
