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
  orderCompleteSchema,
} from '@handly/contracts';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { DispatchService } from '../dispatch/dispatch.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
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

  @Get('jobs')
  getJobHistory(@CurrentUser('id') userId: string, @Query('cursor') cursor?: string) {
    return this.orders.getJobHistory(userId, cursor || undefined);
  }

  // ─────────────── Earnings (M5) ───────────────

  @Get('earnings')
  getEarnings(@CurrentUser('id') userId: string, @Query('cursor') cursor?: string) {
    return this.payments.getMasterEarnings(userId, cursor || undefined);
  }
}
