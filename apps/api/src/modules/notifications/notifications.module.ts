import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

/** Faz 3: yalniz DB bildirimi (ortak hattin bir adimi). Push gonderimi + merkez Faz 4. */
@Module({
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
