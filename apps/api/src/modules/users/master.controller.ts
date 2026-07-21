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
import { z } from 'zod';
import {
  masterAvailabilityUpdateSchema,
  masterProfileUpdateSchema,
  orderCancelByMasterSchema,
  orderCompleteSchema,
  verificationRequestSubmitSchema,
} from '@handly/contracts';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { AnalyticsService } from '../analytics/analytics.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { PenaltiesService } from '../penalties/penalties.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TrustService } from '../trust/trust.service';
import { VerificationService } from '../verification/verification.service';
import { UsersService } from './users.service';

const mediaSchema = z.object({
  kind: z.enum(['CERTIFICATION', 'PORTFOLIO']),
  objectKey: z.string().min(1).max(300),
  caption: z.string().max(200).optional(),
});

@Roles('MASTER')
@Controller('me/master')
export class MasterController {
  constructor(
    private readonly users: UsersService,
    private readonly dispatch: DispatchService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly trust: TrustService,
    private readonly verification: VerificationService,
    private readonly penalties: PenaltiesService,
    private readonly subscriptions: SubscriptionsService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get()
  get(@CurrentUser('id') userId: string) {
    return this.users.getMasterProfile(userId);
  }

  @Patch()
  update(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(masterProfileUpdateSchema))
    dto: ReturnType<typeof masterProfileUpdateSchema.parse>,
  ) {
    return this.users.updateMasterProfile(userId, dto);
  }

  @Post('media')
  addMedia(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(mediaSchema)) dto: z.infer<typeof mediaSchema>,
  ) {
    return this.users.addMasterMedia(userId, dto);
  }

  @Delete('media/:id')
  deleteMedia(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.deleteMasterMedia(userId, id);
  }

  // ─────────────── Dispatch (M3) ───────────────

  @Patch('availability')
  setAvailability(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(masterAvailabilityUpdateSchema))
    dto: ReturnType<typeof masterAvailabilityUpdateSchema.parse>,
  ) {
    return this.users.setMasterAvailability(userId, dto.isOnline);
  }

  @Get('offers/current')
  getCurrentOffer(@CurrentUser('id') userId: string) {
    return this.dispatch.getCurrentOffer(userId);
  }

  @Post('offers/:id/accept')
  acceptOffer(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.dispatch.acceptOffer(id, userId);
  }

  @Post('offers/:id/decline')
  declineOffer(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.dispatch.declineOffer(id, userId);
  }

  @Get('current-job')
  getCurrentJob(@CurrentUser('id') userId: string) {
    return this.orders.getCurrentJob(userId);
  }

  // ─────────────── Job execution (M4) ───────────────

  @Post('current-job/:id/en-route')
  @HttpCode(200)
  startEnRoute(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.startEnRoute(userId, id);
  }

  @Post('current-job/:id/start')
  @HttpCode(200)
  startService(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.startService(userId, id);
  }

  @Post('current-job/:id/complete')
  @HttpCode(200)
  completeService(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(orderCompleteSchema)) dto: ReturnType<typeof orderCompleteSchema.parse>,
  ) {
    return this.orders.completeService(userId, id, dto.finalAmount);
  }

  @Post('current-job/:id/media')
  @HttpCode(201)
  async addJobMedia(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: FastifyRequest,
  ) {
    const mp = await (
      req as FastifyRequest & {
        file: (opts?: unknown) => Promise<{ toBuffer(): Promise<Buffer>; mimetype: string } | undefined>;
      }
    ).file();
    if (!mp) throw new BadRequestException('Fayl yuborilmadi (multipart/form-data, field: file)');
    const buffer = await mp.toBuffer();
    return this.orders.addJobMedia(userId, id, { buffer, mime: mp.mimetype });
  }

  /** Master backs out of an ASSIGNED/EN_ROUTE job (Batch 2) — always penalized. */
  @Post('current-job/:id/cancel')
  @HttpCode(200)
  cancelJob(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(orderCancelByMasterSchema)) dto: ReturnType<typeof orderCancelByMasterSchema.parse>,
  ) {
    return this.orders.cancelByMaster(userId, id, dto.reason);
  }

  @Get('jobs')
  getJobHistory(@CurrentUser('id') userId: string, @Query('cursor') cursor?: string) {
    return this.orders.getJobHistory(userId, cursor || undefined);
  }

  // ─────────────── Earnings (M5) ───────────────

  @Get('earnings')
  getEarnings(@CurrentUser('id') userId: string, @Query('cursor') cursor?: string) {
    return this.payments.getMasterEarnings(userId, cursor || undefined);
  }

  // ─────────────── Trust (Batch 2) ───────────────

  @Get('trust')
  getTrust(@CurrentUser('id') userId: string) {
    return this.trust.recomputeTrustTier(userId);
  }

  // ─────────────── Verification (Batch 2) ───────────────

  @Post('verification')
  @HttpCode(201)
  submitVerification(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(verificationRequestSubmitSchema))
    dto: ReturnType<typeof verificationRequestSubmitSchema.parse>,
  ) {
    return this.verification.submit(userId, dto.note);
  }

  @Get('verification')
  getVerification(@CurrentUser('id') userId: string) {
    return this.verification.getMyLatest(userId);
  }

  // ─────────────── Penalties (Batch 2) ───────────────

  @Get('penalties')
  getPenalties(@CurrentUser('id') userId: string) {
    return this.penalties.getHistory(userId);
  }

  // ─────────────── Subscription (Batch 2) ───────────────

  @Get('subscription')
  getSubscription(@CurrentUser('id') userId: string) {
    return this.subscriptions.getStatus(userId);
  }

  @Post('subscription/upgrade')
  @HttpCode(200)
  upgradeSubscription(@CurrentUser('id') userId: string) {
    return this.subscriptions.upgradeToPremium(userId);
  }

  // ─────────────── Analytics (Batch 2) ───────────────

  @Get('analytics')
  getAnalytics(@CurrentUser('id') userId: string) {
    return this.analytics.getForMaster(userId);
  }
}
