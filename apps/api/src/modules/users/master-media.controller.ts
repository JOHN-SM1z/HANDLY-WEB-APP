import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Public } from '../../common/auth/decorators';
import { UsersService } from './users.service';

/**
 * Streams a master's uploaded certification/portfolio media. Same
 * public-by-unguessable-uuid trust model as orders/media.controller.ts
 * (Beta Blocker Sprint — lets both the master themselves and an admin
 * reviewing a verification request view the image via a plain <img> tag).
 * Kept in modules/users/ rather than added to the existing MediaController
 * (modules/orders/) to avoid a circular import: UsersModule already imports
 * OrdersModule, so a reverse dependency back into UsersService from
 * anything living in OrdersModule would create a cycle.
 */
@Public()
@Controller('media/master')
export class MasterMediaController {
  constructor(private readonly users: UsersService) {}

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @Res() reply: FastifyReply) {
    const { stream, mime } = await this.users.getMasterMediaFile(id);
    void reply
      .header('content-type', mime)
      .header('cache-control', 'private, max-age=3600')
      .send(stream);
  }
}
