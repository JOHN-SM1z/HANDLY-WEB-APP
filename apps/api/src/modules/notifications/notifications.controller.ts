import { Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/decorators';
import { NotificationsService } from './notifications.service';

/** No @Roles() — any authenticated user (customer or master) has their own notifications. */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser('id') userId: string, @Query('cursor') cursor?: string) {
    return this.notifications.list(userId, cursor || undefined);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('id') userId: string) {
    return this.notifications.unreadCount(userId).then((count) => ({ count }));
  }

  @Patch(':id/read')
  markRead(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(userId, id);
  }
}
