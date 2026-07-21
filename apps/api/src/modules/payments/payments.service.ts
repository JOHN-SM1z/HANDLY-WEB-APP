import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  MasterEarningsPage,
  PaymentDto,
  PaymentListPage,
  PaymentMethod,
} from '@handly/contracts';
import type { Payment } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../../infra/payment/payment-provider';
import { TAX_PROVIDER, type TaxProvider } from '../tax/tax-provider';
import { NotificationsService } from '../notifications/notifications.service';

/** Statuses that mean "there's already an active/settled payment for this order". */
const ACTIVE_PAYMENT_STATUSES = ['PENDING', 'PROCESSING', 'SUCCEEDED'] as const;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(TAX_PROVIDER) private readonly tax: TaxProvider,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Customer pays for a COMPLETED job. Duplicate-payment protection: guarded
   * inside a transaction that first checks for any existing active payment
   * for this order (same "read-then-guarded-write" shape as the M4 job
   * transitions) — a double-tap "pay now" can't create two charges.
   */
  async initiate(customerId: string, orderId: string, method: PaymentMethod): Promise<PaymentDto> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (order.customerId !== customerId) throw new ForbiddenException("Ruxsat yo'q");
    if (order.status !== 'COMPLETED' && order.status !== 'CLOSED') {
      throw new ConflictException("Bu buyurtma uchun hali to'lov qilib bo'lmaydi");
    }
    if (order.finalAmount == null) {
      throw new ConflictException("Buyurtma uchun yakuniy narx belgilanmagan");
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      // Lock the order row first so two concurrent initiate() calls for the
      // same order serialize through this transaction — otherwise both could
      // pass the findFirst check before either commits its INSERT (same race
      // class as DispatchService.acceptOffer/TokenService.consumeSession).
      await tx.$executeRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;

      const existing = await tx.payment.findFirst({
        where: { orderId, status: { in: [...ACTIVE_PAYMENT_STATUSES] } },
      });
      if (existing) {
        throw new ConflictException("Bu buyurtma uchun to'lov allaqachon mavjud");
      }

      const amount = order.finalAmount!;
      const platformFee = order.platformFee;
      const masterGross = amount - platformFee;
      const withholding = this.tax.computeWithholding(masterGross);

      return tx.payment.create({
        data: {
          orderId,
          customerId,
          method,
          status: 'PROCESSING',
          amount,
          platformFee,
          taxRate: withholding.rate,
          taxAmount: withholding.taxAmount,
          masterNetAmount: withholding.netAmount,
        },
      });
    });

    // Charging is outside the creation transaction — the provider call is an
    // external I/O boundary, not a DB write; the payment row already exists
    // as the source of truth for "in flight" (mirrors OrdersService.submit's
    // fire-and-forget-after-commit shape, except here we await the result
    // since the mock rail is synchronous and the customer needs the outcome).
    const result = await this.provider.charge({ paymentId: payment.id, amount: payment.amount, method });

    const settled = await this.settle(payment, result);
    return this.toDto(settled);
  }

  /** Idempotent: a webhook replay for an already-settled payment is a no-op. */
  async handleWebhook(providerRef: string, success: boolean, failureReason?: string): Promise<void> {
    const payment = await this.prisma.payment.findFirst({ where: { providerRef } });
    if (!payment || payment.status !== 'PROCESSING') return;
    await this.settle(payment, { success, providerRef, failureReason });
  }

  private async settle(
    payment: Payment,
    result: { success: boolean; providerRef: string; failureReason?: string },
  ): Promise<Payment> {
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: result.success
        ? { status: 'SUCCEEDED', providerRef: result.providerRef, succeededAt: new Date() }
        : { status: 'FAILED', providerRef: result.providerRef, failureReason: result.failureReason, failedAt: new Date() },
    });

    if (result.success) {
      const order = await this.prisma.order.findUnique({ where: { id: payment.orderId } });
      await this.tax.recordWithholding({
        userId: order!.masterId!,
        paymentId: payment.id,
        withholding: {
          rate: Number(payment.taxRate),
          taxAmount: payment.taxAmount,
          netAmount: payment.masterNetAmount,
          grossAmount: payment.amount - payment.platformFee,
        },
      });
      await this.notifications.notify(
        payment.customerId,
        'PAYMENT_SUCCEEDED',
        "To'lov muvaffaqiyatli",
        "To'lovingiz qabul qilindi. Rahmat!",
        { orderId: payment.orderId, paymentId: payment.id },
      );
    } else {
      await this.notifications.notify(
        payment.customerId,
        'PAYMENT_FAILED',
        "To'lov amalga oshmadi",
        "To'lovni qayta urinib ko'ring.",
        { orderId: payment.orderId, paymentId: payment.id },
      );
    }
    return updated;
  }

  async list(customerId: string, orderId: string): Promise<PaymentListPage> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (order.customerId !== customerId) throw new ForbiddenException("Ruxsat yo'q");
    const items = await this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    return { items: items.map((p) => this.toDto(p)), nextCursor: null };
  }

  /** Master's own earnings — SUCCEEDED payments for orders assigned to them. */
  async getMasterEarnings(masterId: string, cursor?: string): Promise<MasterEarningsPage> {
    const take = 20;
    const rows = await this.prisma.payment.findMany({
      where: { status: 'SUCCEEDED', order: { masterId } },
      orderBy: { succeededAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, take);
    const agg = await this.prisma.payment.aggregate({
      where: { status: 'SUCCEEDED', order: { masterId } },
      _sum: { masterNetAmount: true },
      _count: true,
    });
    return {
      summary: {
        totalNetAmount: agg._sum.masterNetAmount ?? 0,
        jobsPaid: agg._count,
      },
      items: items.map((p) => this.toDto(p)),
      nextCursor: rows.length > take ? rows[take]!.id : null,
    };
  }

  private toDto(p: Payment): PaymentDto {
    return {
      id: p.id,
      orderId: p.orderId,
      method: p.method as PaymentDto['method'],
      status: p.status as PaymentDto['status'],
      amount: p.amount,
      platformFee: p.platformFee,
      taxRate: Number(p.taxRate),
      taxAmount: p.taxAmount,
      masterNetAmount: p.masterNetAmount,
      failureReason: p.failureReason,
      createdAt: p.createdAt.toISOString(),
      succeededAt: p.succeededAt?.toISOString() ?? null,
      failedAt: p.failedAt?.toISOString() ?? null,
    };
  }
}
