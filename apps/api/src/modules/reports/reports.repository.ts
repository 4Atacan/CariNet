import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError, ErrorCode } from '@carinet/shared';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PRISMA, type PrismaService } from '../../prisma/prisma.module';

/** §6.4 — dovizli satir TRY karsiligiyla girer; TRY satirda kur 1'dir. */
const AMOUNT_TRY = Prisma.sql`ROUND(t.amount * t.exchange_rate, 2)`;

export interface LedgerItemRow {
  id: string;
  buyer_account_id: string;
  type: 'DEBIT' | 'CREDIT';
  amount: Prisma.Decimal;
  document_date: Date;
  due_date: Date | null;
}

export interface PeriodRow {
  period: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
}

@Injectable()
export class ReportsRepository {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  /** Ham SQL tenant eklentisinin DISINDADIR → seller_id elle ve zorunlu (kural #3). */
  private requireSellerId(): string {
    const sellerId = TenantContext.getSellerId();
    if (!sellerId) {
      throw new AppError(ErrorCode.TENANT_FORBIDDEN, 'Tenant baglami olmadan rapor uretilemez');
    }
    return sellerId;
  }

  /** Risk foyunun girdisi: iptal edilmemis tum hareketler (yaslandirma TS'te FIFO ile yapilir). */
  ledgerItems(buyerAccountIds?: string[]): Promise<LedgerItemRow[]> {
    const sellerId = this.requireSellerId();
    const filter =
      buyerAccountIds && buyerAccountIds.length > 0
        ? Prisma.sql`AND t.buyer_account_id IN (${Prisma.join(buyerAccountIds)})`
        : Prisma.empty;

    return this.prisma.$queryRaw<LedgerItemRow[]>(Prisma.sql`
      SELECT t.id, t.buyer_account_id, t.type, ${AMOUNT_TRY} AS amount,
             t.document_date, t.due_date
      FROM transactions t
      WHERE t.seller_id = ${sellerId}
        AND t.is_cancelled = FALSE
        ${filter}
      ORDER BY t.document_date, t.id
    `);
  }

  /** Donemsel bakiye: aylik borc/alacak toplamlari (kumulatif bakiye serviste turetilir). */
  periodTotals(buyerAccountId: string | null, from: Date | null, to: Date | null) {
    const sellerId = this.requireSellerId();
    const account = buyerAccountId
      ? Prisma.sql`AND t.buyer_account_id = ${buyerAccountId}`
      : Prisma.empty;
    const fromParam = from ? from.toISOString().slice(0, 10) : null;
    const toParam = to ? to.toISOString().slice(0, 10) : null;

    return this.prisma.$queryRaw<PeriodRow[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', t.document_date), 'YYYY-MM') AS period,
             COALESCE(SUM(CASE WHEN t.type = 'DEBIT'  THEN ${AMOUNT_TRY} ELSE 0 END), 0) AS debit,
             COALESCE(SUM(CASE WHEN t.type = 'CREDIT' THEN ${AMOUNT_TRY} ELSE 0 END), 0) AS credit
      FROM transactions t
      WHERE t.seller_id = ${sellerId}
        AND t.is_cancelled = FALSE
        ${account}
        AND (${fromParam}::date IS NULL OR t.document_date >= ${fromParam}::date)
        AND (${toParam}::date IS NULL OR t.document_date <= ${toParam}::date)
      GROUP BY 1
      ORDER BY 1
    `);
  }

  /** Donem baslangicindan ONCEKI bakiye (grafigin acilis noktasi — devir gorunmez olmasin). */
  async openingBalance(buyerAccountId: string | null, from: Date | null): Promise<string> {
    if (!from) return '0';
    const sellerId = this.requireSellerId();
    const account = buyerAccountId
      ? Prisma.sql`AND t.buyer_account_id = ${buyerAccountId}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<{ balance: Prisma.Decimal }[]>(Prisma.sql`
      SELECT COALESCE(SUM(
        (CASE WHEN t.type = 'DEBIT' THEN 1 ELSE -1 END) * ${AMOUNT_TRY}
      ), 0) AS balance
      FROM transactions t
      WHERE t.seller_id = ${sellerId}
        AND t.is_cancelled = FALSE
        ${account}
        AND t.document_date < ${from.toISOString().slice(0, 10)}::date
    `);
    return (rows[0]?.balance ?? new Prisma.Decimal(0)).toString();
  }

  /** Risk foyu satirlari icin cari basligi (tenant eklentisi filtreler). */
  buyerAccounts(buyerAccountId?: string) {
    return this.prisma.buyerAccount.findMany({
      where: buyerAccountId ? { id: buyerAccountId } : {},
      orderBy: { accountCode: 'asc' },
      select: { id: true, accountCode: true, title: true, creditLimit: true, isActive: true },
    });
  }

  /** Ekstre PDF basligi icin satici bilgisi (Seller tenant modeli degil — kok). */
  seller(sellerId: string) {
    return this.prisma.seller.findUnique({ where: { id: sellerId } });
  }
}
