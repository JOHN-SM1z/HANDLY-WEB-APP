import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { adminPaymentResolveSchema } from '@handly/contracts';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PaymentsService } from '../payments/payments.service';

/**
 * Manual payment-resolution foundation (Beta Blocker Sprint) — the only
 * admin mutation that touches money, and deliberately narrow: no real
 * PaymentProvider reversal call, just a documented, audited status change
 * plus a customer notification. Same "read before/after, audit-log the
 * decide call" shape as AdminController's verification/guarantee decisions.
 */
@Roles('ADMIN')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Post(':id/resolve')
  @HttpCode(200)
  async resolve(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adminPaymentResolveSchema)) dto: ReturnType<typeof adminPaymentResolveSchema.parse>,
  ) {
    const before = await this.prisma.payment.findUnique({ where: { id } });
    const result = await this.payments.resolve(id, adminId, dto.refund, dto.note);
    await this.audit.record(
      adminId,
      dto.refund ? 'PAYMENT_REFUND' : 'PAYMENT_RESOLVE',
      'Payment',
      id,
      before ? { status: before.status } : undefined,
      { status: result.status },
    );
    return result;
  }
}
