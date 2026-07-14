import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

/** §13 Faz 4 — kampanyalar + push duyurusu. */
@Module({
  imports: [NotificationsModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, NotificationsRepository],
})
export class CampaignsModule {}
