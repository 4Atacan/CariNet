import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CollectionsRepository } from './collections.repository';

/**
 * §8 — bekleyen talep 72 saatte EXPIRED olur (INTENT_TTL_HOURS).
 * Suresi dolmus talep onaylanamaz: eski bir referans koduyla gelen dekont insana sorulur.
 * Cron TUM saticilar icin calisir → repository sistem modunda sorgular (kural #3'un
 * mesru istisnasi: istek baglami yok).
 */
@Injectable()
export class IntentExpiryTask {
  private readonly logger = new Logger(IntentExpiryTask.name);

  constructor(private readonly repo: CollectionsRepository) {}

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'expire-collect-intents' })
  async run(): Promise<void> {
    const result = await this.repo.expirePending();
    if (result.count > 0) {
      this.logger.log(`${result.count} odeme talebi suresi doldugu icin EXPIRED yapildi`);
    }
  }
}
