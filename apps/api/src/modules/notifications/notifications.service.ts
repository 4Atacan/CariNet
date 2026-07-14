import { Injectable, Logger } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import {
  AppError,
  ErrorCode,
  paginate,
  type MarkReadInput,
  type NotificationListQuery,
  type NotificationType,
  type RegisterPushTokenInput,
} from '@carinet/shared';
import { Paginated } from '../../common/dto/paginated';
import { type RequestUser } from '../../common/types/request-with-user';
import { type TxClient } from '../../prisma/prisma.module';
import { NotificationsRepository } from './notifications.repository';
import { PushService, type PushMessage } from './push.service';

export interface NotifyInput {
  userIds: string[];
  /** Cron/sistem isinde baglam yok → satici ACIKCA tasinir (kural #3). */
  sellerId: string;
  buyerAccountId: string | null;
  title: string;
  body: string;
  type: NotificationType;
  /** Mobil dogru ekrana gitsin diye (fatura/tahsilat/kampanya id'si). */
  entityId?: string;
}

/**
 * §13 Faz 4 ortak hat: olay → DB bildirimi → (commit sonrasi) push.
 *
 * DB kaydi ile push AYRI adimlardir ve bu bilincli:
 *   · `notify()` finansal islemle AYNI transaction'da yazar → islem geri alinirsa bildirim de gitmez.
 *   · `push()` transaction BITTIKTEN sonra cagrilir → geri alinan bir islem icin telefon otmez.
 * Push basarisiz olsa bile bildirim merkezi calisir (kayit DB'de durur).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly push: PushService,
  ) {}

  /** DB bildirimi (transaction icinde cagrilabilir). */
  async notify(input: NotifyInput, tx?: TxClient): Promise<number> {
    if (input.userIds.length === 0) return 0;

    const rows: Prisma.NotificationUncheckedCreateInput[] = input.userIds.map((userId) => ({
      userId,
      sellerId: input.sellerId,
      buyerAccountId: input.buyerAccountId,
      title: input.title,
      body: input.body,
      type: input.type,
    }));

    const result = await this.repo.createMany(rows, tx);
    return result.count;
  }

  /**
   * Cihaza push. Payload HESAP BAGLAMI tasir (§6.2): ayni kullanici birden cok saticinin
   * carisinde olabilir → mobil, bildirimi dogru hesaba yazar.
   */
  async sendPush(input: NotifyInput): Promise<{ sent: number; failed: number }> {
    if (input.userIds.length === 0) return { sent: 0, failed: 0 };

    const tokens = await this.repo.tokensOf(input.userIds);
    if (tokens.length === 0) return { sent: 0, failed: 0 };

    const messages: PushMessage[] = tokens.map((t) =>
      this.push.buildMessage(t.token, input.title, input.body, {
        sellerId: input.sellerId,
        buyerAccountId: input.buyerAccountId,
        type: input.type,
        ...(input.entityId ? { entityId: input.entityId } : {}),
      }),
    );

    const result = await this.push.send(messages);
    if (result.invalidTokens.length > 0) {
      // Uygulamayi silmis cihazlarin tokenlari birikmesin.
      await this.repo.deleteTokens(result.invalidTokens);
      this.logger.log(`${result.invalidTokens.length} olu push token silindi`);
    }
    return { sent: result.sent, failed: result.failed };
  }

  /** DB + push tek adimda (transaction DISINDA cagrilir). */
  async notifyAndPush(input: NotifyInput): Promise<void> {
    await this.notify(input);
    await this.sendPush(input);
  }

  // ---------------------------------------------------------------- bildirim merkezi

  async list(query: NotificationListQuery, user: RequestUser) {
    const { skip, take } = paginate(query.page, query.limit);
    const { rows, total } = await this.repo.list(
      user.userId,
      user.buyerAccountId ?? null,
      query,
      skip,
      take,
    );
    return Paginated.of(rows, query.page, query.limit, total);
  }

  /** Rozet: AKTIF hesabin okunmamis bildirim sayisi (§13 Faz 4). */
  async unreadCount(user: RequestUser) {
    const count = await this.repo.unreadCount(user.userId, user.buyerAccountId ?? null);
    return { unread: count };
  }

  async markRead(input: MarkReadInput, user: RequestUser) {
    if (!input.all && !input.ids?.length) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Okunacak bildirim secilmedi');
    }
    const result = await this.repo.markRead(
      user.userId,
      user.buyerAccountId ?? null,
      input.all ? undefined : input.ids,
    );
    return { updated: result.count };
  }

  // ---------------------------------------------------------------- push tokenlari

  async registerToken(input: RegisterPushTokenInput, user: RequestUser) {
    if (!PushService.isExpoToken(input.token)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Gecersiz push token bicimi');
    }
    await this.repo.upsertToken(user.userId, input.token, input.platform, input.deviceName);
    return { registered: true };
  }

  async unregisterToken(token: string) {
    await this.repo.deleteToken(token);
    return { registered: false };
  }
}
