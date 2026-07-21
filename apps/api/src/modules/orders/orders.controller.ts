import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  guaranteeClaimCreateSchema,
  orderCreateSchema,
  orderSubmitSchema,
  orderUpdateSchema,
  OrderStatus,
  paymentInitiateSchema,
  reviewCreateSchema,
} from '@handly/contracts';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { GuaranteeService } from '../guarantee/guarantee.service';
import { PaymentsService } from '../payments/payments.service';
import { ReviewsService } from '../reviews/reviews.service';
import { OrdersService } from './orders.service';

@Roles('CUSTOMER')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly reviews: ReviewsService,
    private readonly guarantee: GuaranteeService,
  ) {}

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(orderCreateSchema)) dto: ReturnType<typeof orderCreateSchema.parse>,
  ) {
    return this.orders.createDraft(userId, dto);
  }

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
  ) {
    const valid = status && status in OrderStatus ? (status as OrderStatus) : undefined;
    return this.orders.list(userId, cursor || undefined, valid);
  }

  @Get(':id')
  getOne(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(orderUpdateSchema)) dto: ReturnType<typeof orderUpdateSchema.parse>,
  ) {
    return this.orders.updateDraft(userId, id, dto);
  }

  @Post(':id/media')
  @HttpCode(201)
  async addMedia(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: FastifyRequest,
  ) {
    // @fastify/multipart is registered in main.ts.
    const mp = await (
      req as FastifyRequest & {
        file: (opts?: unknown) => Promise<{ toBuffer(): Promise<Buffer>; mimetype: string } | undefined>;
      }
    ).file();
    if (!mp) throw new BadRequestException('Fayl yuborilmadi (multipart/form-data, field: file)');
    const buffer = await mp.toBuffer();
    return this.orders.addMedia(userId, id, { buffer, mime: mp.mimetype });
  }

  @Delete(':id/media/:mediaId')
  deleteMedia(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ) {
    return this.orders.deleteMedia(userId, id, mediaId);
  }

  @Post(':id/diagnose')
  @HttpCode(200)
  diagnose(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.diagnose(userId, id);
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(orderSubmitSchema)) _dto: ReturnType<typeof orderSubmitSchema.parse>,
  ) {
    return this.orders.submit(userId, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.cancel(userId, id);
  }

  /** Customer confirms a COMPLETED job, closing it (M4). */
  @Post(':id/confirm')
  @HttpCode(200)
  confirm(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.confirmCompletion(userId, id);
  }

  // ─────────────── Payments (M5) ───────────────

  @Post(':id/payments')
  @HttpCode(201)
  initiatePayment(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(paymentInitiateSchema)) dto: ReturnType<typeof paymentInitiateSchema.parse>,
  ) {
    return this.payments.initiate(userId, id, dto.method);
  }

  @Get(':id/payments')
  listPayments(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.list(userId, id);
  }

  // ─────────────── Reviews (Batch 2) ───────────────

  @Post(':id/review')
  @HttpCode(201)
  createReview(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reviewCreateSchema)) dto: ReturnType<typeof reviewCreateSchema.parse>,
  ) {
    return this.reviews.create(userId, id, dto.rating, dto.comment);
  }

  @Get(':id/review')
  getReview(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    // Ownership isn't re-checked here beyond the order lookup below since a
    // review is safe to read by its own customer only — reuse getOne's guard.
    return this.orders.getOne(userId, id).then(() => this.reviews.getForOrder(id));
  }

  // ─────────────── Handly Guarantee (Batch 2) ───────────────

  @Post(':id/guarantee-claim')
  @HttpCode(201)
  fileGuaranteeClaim(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(guaranteeClaimCreateSchema)) dto: ReturnType<typeof guaranteeClaimCreateSchema.parse>,
  ) {
    return this.guarantee.fileClaim(userId, id, dto.reason);
  }

  @Get(':id/guarantee-claim')
  getGuaranteeClaim(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.guarantee.getForOrder(userId, id);
  }
}
