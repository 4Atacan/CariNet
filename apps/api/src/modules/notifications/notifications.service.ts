import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { type NotificationType } from '@carinet/shared';
import { PRISMA, type PrismaService, type TxClient } from '../../prisma/prisma.module';

export interface NotificationInput {
  userIds: string[];
  buyerAccountId: string | null;
  title: string;
  body: string;
  type: NotificationType;
}

/**
 * §13 Faz 3 ortak hatti: CONFIRMED → CREDIT → BILDIRIM → audit.
 * Bu servis bildirimi VERITABANINA yazar (rozet/bildirim merkezi bunu okur).
 * Cihaza push GONDERIMI (expo-notifications + token kaydi) Faz 4'un isidir; payload'in
 * hesap baglami (sellerId + buyerAccountId) burada zaten kayitli oldugu icin Faz 4
 * bu satirlarin uzerine kurulur.
 */
@Injectable()
export class NotificationsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  /** Finansal islemle ayni transaction'da yazilir → islem geri alinirsa bildirim de gitmez. */
  async notify(input: NotificationInput, tx?: TxClient): Promise<number> {
    if (input.userIds.length === 0) return 0;

    // sellerId'yi tenant eklentisi ekler (kural #3) → tipte yok, veride var.
    const data: Omit<Prisma.NotificationUncheckedCreateInput, 'sellerId'>[] = input.userIds.map(
      (userId) => ({
        userId,
        buyerAccountId: input.buyerAccountId,
        title: input.title,
        body: input.body,
        type: input.type,
      }),
    );

    const client = tx ?? this.prisma;
    const result = await client.notification.createMany({
      data: data as Prisma.NotificationUncheckedCreateInput[],
    });
    return result.count;
  }
}
