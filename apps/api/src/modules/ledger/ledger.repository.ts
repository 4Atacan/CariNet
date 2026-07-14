import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError, ErrorCode } from '@carinet/shared';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PRISMA, type PrismaService } from '../../prisma/prisma.module';

/**
 * §6.4 — yuruyen bakiye. CLAUDE.md'deki SQL ham `amount` toplar; bu yalniz TUM satirlar TRY iken
 * dogrudur. Dovizli satirda (kur satira sabit, §7) TRY karsiligi = ROUND(amount * exchange_rate, 2).
 * Asagidaki ifade TRY satirlarda (rate = 1) §6.4 ile birebir ayni sonucu verir; dovizde dogruyu verir.
 */
const SIGNED_TRY = Prisma.sql`(CASE WHEN t.type = 'DEBIT' THEN 1 ELSE -1 END) * ROUND(t.amount * t.exchange_rate, 2)`;

/** Ham SQL ciktisi (snake_case). */
export interface StatementRawRow {
  id: string;
  type: 'DEBIT' | 'CREDIT';
  document_type: string;
  document_no: string | null;
  document_date: Date;
  due_date: Date | null;
  amount: Prisma.Decimal;
  currency_code: string;
  exchange_rate: Prisma.Decimal;
  amount_try: Prisma.Decimal;
  description: string | null;
  invoice_id: string | null;
  running_balance: Prisma.Decimal;
}

export interface BalanceRawRow {
  buyer_account_id: string;
  total_debit: Prisma.Decimal;
  total_credit: Prisma.Decimal;
}

export interface StatementFilter {
  from?: Date;
  to?: Date;
  skip: number;
  take: number;
}

@Injectable()
export class LedgerRepository {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  /**
   * DIKKAT: $queryRaw tenant eklentisinin DISINDADIR (eklenti yalniz model delegate'lerini sarar).
   * Bu yuzden seller_id filtresi her ham sorguda ELLE ve zorunlu olarak konur (kural #3).
   */
  private requireSellerId(): string {
    const sellerId = TenantContext.getSellerId();
    if (!sellerId) {
      throw new AppError(ErrorCode.TENANT_FORBIDDEN, 'Tenant baglami olmadan defter sorgulanamaz');
    }
    return sellerId;
  }

  /** Yuruyen bakiye TUM tarihce uzerinden hesaplanir, tarih filtresi SONRA uygulanir. */
  async statement(buyerAccountId: string, filter: StatementFilter): Promise<StatementRawRow[]> {
    const sellerId = this.requireSellerId();
    const from = toDateParam(filter.from);
    const to = toDateParam(filter.to);

    return this.prisma.$queryRaw<StatementRawRow[]>(Prisma.sql`
      WITH ledger AS (
        SELECT t.id, t.type, t.document_type, t.document_no, t.document_date, t.due_date,
               t.amount, t.currency_code, t.exchange_rate, t.description, t.invoice_id,
               ROUND(t.amount * t.exchange_rate, 2) AS amount_try,
               SUM(${SIGNED_TRY}) OVER (
                 PARTITION BY t.buyer_account_id ORDER BY t.document_date, t.id
               ) AS running_balance
        FROM transactions t
        WHERE t.seller_id = ${sellerId}
          AND t.buyer_account_id = ${buyerAccountId}
          AND t.is_cancelled = FALSE
      )
      SELECT * FROM ledger
      WHERE (${from}::date IS NULL OR document_date >= ${from}::date)
        AND (${to}::date IS NULL OR document_date <= ${to}::date)
      ORDER BY document_date DESC, id DESC
      LIMIT ${filter.take} OFFSET ${filter.skip}
    `);
  }

  async statementCount(buyerAccountId: string, from?: Date, to?: Date): Promise<number> {
    const sellerId = this.requireSellerId();
    const fromParam = toDateParam(from);
    const toParam = toDateParam(to);
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM transactions t
      WHERE t.seller_id = ${sellerId}
        AND t.buyer_account_id = ${buyerAccountId}
        AND t.is_cancelled = FALSE
        AND (${fromParam}::date IS NULL OR t.document_date >= ${fromParam}::date)
        AND (${toParam}::date IS NULL OR t.document_date <= ${toParam}::date)
    `);
    return Number(rows[0]?.count ?? 0n);
  }

  /** Cari listesinde canli bakiye: tek sorguda tum hesaplarin borc/alacak toplami (N+1 yok). */
  async sumsByAccount(buyerAccountIds: string[]): Promise<BalanceRawRow[]> {
    if (buyerAccountIds.length === 0) return [];
    const sellerId = this.requireSellerId();

    return this.prisma.$queryRaw<BalanceRawRow[]>(Prisma.sql`
      SELECT t.buyer_account_id,
             COALESCE(SUM(CASE WHEN t.type = 'DEBIT'
                               THEN ROUND(t.amount * t.exchange_rate, 2) ELSE 0 END), 0) AS total_debit,
             COALESCE(SUM(CASE WHEN t.type = 'CREDIT'
                               THEN ROUND(t.amount * t.exchange_rate, 2) ELSE 0 END), 0) AS total_credit
      FROM transactions t
      WHERE t.seller_id = ${sellerId}
        AND t.is_cancelled = FALSE
        AND t.buyer_account_id IN (${Prisma.join(buyerAccountIds)})
      GROUP BY t.buyer_account_id
    `);
  }
}

/** @db.Date kolonlariyla karsilastirma icin gun hassasiyetinde string (UTC). */
const toDateParam = (d?: Date): string | null => (d ? d.toISOString().slice(0, 10) : null);
