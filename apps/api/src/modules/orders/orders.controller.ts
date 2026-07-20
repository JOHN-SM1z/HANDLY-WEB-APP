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
  orderCreateSchema,
  orderSubmitSchema,
  orderUpdateSchema,
  OrderStatus,
} from '@handly/contracts';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { OrdersService } from './orders.service';

@Roles('CUSTOMER')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

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
}
