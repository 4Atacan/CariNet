import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { type NotificationListQuery } from '@carinet/shared';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PRISMA, type PrismaService, type TxClient } from '../../prisma/prisma.module';

/**
 * Notification tenant modelidir (seller_id eklentiden gelir).
 * PushToken DEGILDIR: kullanici+cihaz bazlidir (§6.2) → sistem modunda okunur/yazilir.
 */
@Injectable()
export class NotificationsRepository {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  createMany(rows: Prisma.NotificationUncheckedCreateInput[], tx?: TxClient) {
    return (tx ?? this.prisma).notification.createMany({ data: rows });
  }

  /** Bildirim merkezi: kullanici + AKTIF HESAP baglami (§13 Faz 4 "hesap bazli rozet"). */
  async list(
    userId: string,
    buyerAccountId: string | null,
    query: NotificationListQuery,
    skip: number,
    take: number,
  ) {
    const where = this.scope(userId, buyerAccountId, query);
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { rows, total };
  }

  unreadCount(userId: string, buyerAccountId: string | null) {
    return this.prisma.notification.count({
      where: this.scope(userId, buyerAccountId, { unreadOnly: true }),
    });
  }

  markRead(userId: string, buyerAccountId: string | null, ids?: string[]) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        ...(buyerAccountId ? { buyerAccountId } : {}),
        ...(ids ? { id: { in: ids } } : {}),
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  private scope(
    userId: string,
    buyerAccountId: string | null,
    query: Partial<NotificationListQuery>,
  ): Prisma.NotificationWhereInput {
    return {
      userId,
      // Alici baglaminda yalniz O hesabin bildirimleri (coklu uyelik — §6.2).
      ...(buyerAccountId ? { buyerAccountId } : {}),
      ...(query.unreadOnly ? { readAt: null } : {}),
      ...(query.type ? { type: query.type } : {}),
    };
  }

  // ---------------------------------------------------------------- push tokenlari

  upsertToken(userId: string, token: string, platform: string, deviceName?: string) {
    return TenantContext.runAsSystem(() =>
      this.prisma.pushToken.upsert({
        where: { token },
        create: { userId, token, platform, deviceName },
        // Token baska bir kullaniciya gecmis olabilir (ayni cihaz, farkli hesap) → sahibi guncellenir.
        update: { userId, platform, deviceName, lastSeenAt: new Date() },
      }),
    );
  }

  deleteToken(token: string) {
    return TenantContext.runAsSystem(() => this.prisma.pushToken.deleteMany({ where: { token } }));
  }

  /** Bildirim gonderilecek kullanicilarin TUM cihazlari. */
  tokensOf(userIds: string[]) {
    return TenantContext.runAsSystem(() =>
      this.prisma.pushToken.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, token: true },
      }),
    );
  }

  /** Expo "DeviceNotRegistered" dedi → olu tokenlar temizlenir. */
  deleteTokens(tokens: string[]) {
    if (tokens.length === 0) return Promise.resolve({ count: 0 });
    return TenantContext.runAsSystem(() =>
      this.prisma.pushToken.deleteMany({ where: { token: { in: tokens } } }),
    );
  }

  /** Kampanya duyurusu: saticinin aktif carilerine bagli TUM kullanicilar. */
  usersOfSeller(buyerAccountIds?: string[]) {
    return this.prisma.buyerAccount.findMany({
      where: {
        isActive: true,
        ...(buyerAccountIds?.length ? { id: { in: buyerAccountIds } } : {}),
      },
      select: {
        id: true,
        memberships: { select: { userId: true } },
      },
    });
  }
}
