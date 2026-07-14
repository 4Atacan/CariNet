import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  NotificationType,
  computeAging,
  formatMoney,
  reminderFor,
  reminderText,
  toMoney,
  type LedgerItem,
} from '@carinet/shared';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PRISMA, type PrismaService } from '../../prisma/prisma.module';
import { NotificationsService } from './notifications.service';

/**
 * §13 Faz 4 — vade hatirlatma cronu.
 *
 * KRITIK: hatirlatma yalniz ACIK kalemler icin gider. Alici borcunu odemisse (tahsilat
 * FIFO ile en eski borctan dusuluyor — §6.4/Faz 2) o fatura icin telefonu calmaz.
 * Aksi halde odemis musteriye "borcunuz var" demis oluruz.
 *
 * Cron TUM saticilar icin calisir → sistem modunda sorgular (istek baglami yok).
 */
@Injectable()
export class DueReminderTask {
  private readonly logger = new Logger(DueReminderTask.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Sabah 09:00 — is gunune baslarken. */
  @Cron(CronExpression.EVERY_DAY_AT_9AM, { name: 'due-reminders' })
  async run(asOf: Date = new Date()): Promise<{ accounts: number; reminders: number }> {
    return TenantContext.runAsSystem(async () => {
      const accounts = await this.prisma.buyerAccount.findMany({
        where: { isActive: true, seller: { isActive: true } },
        select: {
          id: true,
          sellerId: true,
          memberships: { select: { userId: true } },
          transactions: {
            where: { isCancelled: false },
            select: {
              id: true,
              type: true,
              amount: true,
              exchangeRate: true,
              documentNo: true,
              documentDate: true,
              dueDate: true,
            },
            orderBy: { documentDate: 'asc' },
          },
        },
      });

      let reminders = 0;

      for (const account of accounts) {
        const userIds = account.memberships.map((m) => m.userId);
        if (userIds.length === 0) continue; // davet edilmemis cari — bildirecek kimse yok

        // FIFO: alacaklar en eski borctan kapatilir → geriye ACIK kalemler kalir (Faz 2).
        const items: LedgerItem[] = account.transactions.map((t) => ({
          id: t.id,
          type: t.type,
          // Bakiye TRY'dir: kur satira sabit, carpim decimal.js ile (§6.4, kural #1).
          amount: toMoney(t.amount.mul(t.exchangeRate).toString()),
          documentDate: toIsoDate(t.documentDate),
          dueDate: t.dueDate ? toIsoDate(t.dueDate) : null,
        }));
        const { openItems } = computeAging(items, asOf);

        const byId = new Map(account.transactions.map((t) => [t.id, t]));

        for (const open of openItems) {
          if (!open.dueDate) continue; // vadesiz kalem (devir vs.) hatirlatilmaz
          const kind = reminderFor(new Date(`${open.dueDate}T00:00:00.000Z`), asOf);
          if (!kind) continue;

          const source = byId.get(open.id);
          const text = reminderText(
            kind,
            source?.documentNo ?? null,
            formatMoney(open.remaining),
            Math.max(open.overdueDays, 0),
          );

          const payload = {
            userIds,
            sellerId: account.sellerId,
            buyerAccountId: account.id,
            title: text.title,
            body: text.body,
            type: NotificationType.DUE_REMINDER,
            entityId: open.id,
          };

          await this.notifications.notify(payload);
          await this.notifications.sendPush(payload);
          reminders += 1;
        }
      }

      if (reminders > 0) {
        this.logger.log(`${reminders} vade hatirlatmasi gonderildi (${accounts.length} cari)`);
      }
      return { accounts: accounts.length, reminders };
    });
  }
}

const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);
