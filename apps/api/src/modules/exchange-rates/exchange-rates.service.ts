import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { type Prisma } from '@prisma/client';
import { toRate, type ExchangeRateQuery } from '@carinet/shared';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PRISMA, type PrismaService } from '../../prisma/prisma.module';
import { TcmbParser } from './tcmb.parser';

const TCMB_TODAY_URL = 'https://www.tcmb.gov.tr/kurlar/today.xml';

/**
 * §13 Faz 4 — TCMB kur cronu + Kurlar ekrani.
 * ExchangeRate TENANT DISIDIR (global tablo) → sistem modunda yazilir/okunur.
 *
 * Not: bu kurlar BILGI amaclidir. Faturaya/hareketle yazilan kur KAYIT ANINDA satira
 * sabitlenir (§7) — gecmise donuk kur degisimi bakiyeyi OYNATMAZ (kural #2).
 */
@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaService,
    private readonly tcmb: TcmbParser,
  ) {}

  /** TCMB kurlari her is gunu 15:30 civari yayinlar; 16:00'da cekmek guvenli. */
  @Cron(CronExpression.EVERY_DAY_AT_4PM, { name: 'tcmb-rates' })
  async sync(): Promise<{ saved: number }> {
    try {
      const response = await fetch(TCMB_TODAY_URL);
      if (!response.ok) {
        this.logger.warn({ status: response.status }, 'TCMB kur servisi yanit vermedi');
        return { saved: 0 };
      }

      const rates = this.tcmb.parse(await response.text());
      const saved = await this.save(rates);
      this.logger.log(`TCMB: ${saved} kur guncellendi`);
      return { saved };
    } catch (error) {
      // Kur cekilemezse uygulama calismaya devam eder: mevcut kurlar gecerlidir.
      this.logger.warn({ err: error }, 'TCMB kurlari cekilemedi');
      return { saved: 0 };
    }
  }

  async save(rates: { currencyCode: string; rate: string; date: Date }[]): Promise<number> {
    return TenantContext.runAsSystem(async () => {
      let saved = 0;
      for (const rate of rates) {
        // Ayni gun tekrar cekilirse guncellenir (idempotent).
        await this.prisma.exchangeRate.upsert({
          where: { date_currencyCode: { date: rate.date, currencyCode: rate.currencyCode } },
          create: { date: rate.date, currencyCode: rate.currencyCode, rate: rate.rate },
          update: { rate: rate.rate },
        });
        saved += 1;
      }
      return saved;
    });
  }

  /** Kurlar ekrani: son kurlar (veya tarih araligi). */
  async list(query: ExchangeRateQuery) {
    const where: Prisma.ExchangeRateWhereInput = {
      ...(query.currencyCode ? { currencyCode: query.currencyCode } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    const rows = await TenantContext.runAsSystem(() =>
      this.prisma.exchangeRate.findMany({
        where,
        orderBy: [{ date: 'desc' }, { currencyCode: 'asc' }],
        take: 200,
      }),
    );

    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      currencyCode: r.currencyCode.trim(),
      rate: toRate(r.rate.toString()),
    }));
  }

  /** Her para birimi icin EN GUNCEL kur (mobil "Kurlar" ekrani). */
  async latest() {
    const rows = await TenantContext.runAsSystem(() =>
      this.prisma.exchangeRate.findMany({ orderBy: { date: 'desc' }, take: 100 }),
    );

    const seen = new Map<string, { date: string; currencyCode: string; rate: string }>();
    for (const row of rows) {
      const code = row.currencyCode.trim();
      if (seen.has(code)) continue; // rows tarih DESC → ilk gorulen en guncel
      seen.set(code, {
        date: row.date.toISOString().slice(0, 10),
        currencyCode: code,
        rate: toRate(row.rate.toString()),
      });
    }
    return [...seen.values()];
  }
}
