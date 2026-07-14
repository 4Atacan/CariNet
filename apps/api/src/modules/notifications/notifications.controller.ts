import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import {
  markReadSchema,
  notificationListQuerySchema,
  registerPushTokenSchema,
} from '@carinet/shared';
import { CurrentUser } from '../../common/decorators';
import { type RequestUser } from '../../common/types/request-with-user';
import { NotificationsService } from './notifications.service';

class NotificationListDto extends createZodDto(notificationListQuerySchema) {}
class MarkReadDto extends createZodDto(markReadSchema) {}
class RegisterTokenDto extends createZodDto(registerPushTokenSchema) {}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Bildirim merkezi — AKTIF hesabin bildirimleri (§6.2)' })
  list(@Query() query: NotificationListDto, @CurrentUser() user: RequestUser) {
    return this.notifications.list(query, user);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Rozet: aktif hesabin okunmamis bildirim sayisi' })
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.notifications.unreadCount(user);
  }

  @Post('read')
  @ApiOperation({ summary: 'Bildirimleri okundu isaretler' })
  markRead(@Body() body: MarkReadDto, @CurrentUser() user: RequestUser) {
    return this.notifications.markRead(body, user);
  }

  @Post('tokens')
  @ApiOperation({ summary: 'Cihaz push tokenini kaydeder (kullanici+cihaz bazli, §6.2)' })
  registerToken(@Body() body: RegisterTokenDto, @CurrentUser() user: RequestUser) {
    return this.notifications.registerToken(body, user);
  }

  @Delete('tokens/:token')
  @ApiOperation({ summary: 'Cikista tokeni siler (baska hesap bu cihazda bildirim almasin)' })
  unregisterToken(@Param('token') token: string) {
    return this.notifications.unregisterToken(token);
  }
}
