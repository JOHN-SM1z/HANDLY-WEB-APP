import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Public } from '../../common/auth/decorators';
import { OrdersService } from './orders.service';

/**
 * Streams uploaded media. Public-by-unguessable-uuid (same trust model as an
 * S3 presigned GET, which replaces this in a later milestone); <img>/<video>
 * tags can't send Bearer headers. No listing endpoint exists.
 */
@Public()
@Controller('media')
export class MediaController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @Res() reply: FastifyReply) {
    const { stream, mime } = await this.orders.getMediaFile(id);
    void reply
      .header('content-type', mime)
      .header('cache-control', 'private, max-age=3600')
      .send(stream);
  }
}
