import { Module } from '@nestjs/common';
import { DueReminderTask } from './due-reminder.task';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

/** §13 Faz 4 — bildirim merkezi + hesap baglamli push (Expo, ucretsiz → kural #8) + vade cronu. */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsRepository, NotificationsService, PushService, DueReminderTask],
  exports: [NotificationsService, DueReminderTask],
})
export class NotificationsModule {}
