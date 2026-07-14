import { Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorCode,
  UserRole,
  add,
  computeAging,
  computeAverageDue,
  limitUsagePercent,
  sub,
  toMoney,
  type AgingBucket,
  type LedgerItem,
  type MoneyString,
  type RiskRow,
  type TransactionType,
} from '@carinet/shared';
import { type RequestUser } from '../../common/types/request-with-user';
import { ReportsRepository, type LedgerItemRow } from './reports.repository';

export interface PeriodPoint {
  period: string;
  debit: MoneyString;
  credit: MoneyString;
  /** Donem sonu kumulatif bakiye (acilis + o ana kadarki hareketler). */
  balance: MoneyString;
}

export interface RiskDetail extends RiskRow {
  openItems: {
    id: string;
    remaining: MoneyString;
    dueDate: string | null;
    documentDate: string;
    overdueDays: number;
    bucket: AgingBucket;
  }[];
}

@Injectable()
export class ReportsService {
  constructor(private readonly repo: ReportsRepository) {}

  /**
   * Risk Foyu (§13 Faz 2): acik bakiye, vadesi gecen, yaslandirma kovalari, limit %.
   * Tum hesap TS'te decimal.js ile; SQL yalniz veriyi getirir (kural #1).
   */
  async risk(user: RequestUser, buyerAccountId?: string): Promise<RiskRow[]> {
    const scoped = this.scopeAccount(user, buyerAccountId);
    const accounts = await this.repo.buyerAccounts(scoped);
    if (accounts.length === 0) return [];

    const items = await this.repo.ledgerItems(accounts.map((a) => a.id));
    const byAccount = groupByAccount(items);
    const asOf = new Date();

    return accounts.map((account) => {
      const aging = computeAging(byAccount.get(account.id) ?? [], asOf);
      const average = computeAverageDue(aging.openItems, asOf);
      const creditLimit = toMoney(account.creditLimit.toString());

      return {
        buyerAccountId: account.id,
        accountCode: account.accountCode,
        title: account.title,
        creditLimit,
        balance: aging.balance,
        overdue: aging.overdue,
        notDue: aging.notDue,
        buckets: aging.buckets,
        limitUsagePercent: limitUsagePercent(aging.balance, creditLimit),
        averageDueDate: average.averageDueDate,
        averageOverdueDays: average.averageOverdueDays,
      };
    });
  }

  /** Tek carinin risk foyu + acik kalem listesi (hangi fatura ne kadar acik). */
  async riskDetail(id: string, user: RequestUser): Promise<RiskDetail> {
    const scoped = this.scopeAccount(user, id);
    const [account] = await this.repo.buyerAccounts(scoped ?? id);
    if (!account) throw new AppError(ErrorCode.NOT_FOUND);

    const items = await this.repo.ledgerItems([account.id]);
    const asOf = new Date();
    const aging = computeAging(items.map(toLedgerItem), asOf);
    const average = computeAverageDue(aging.openItems, asOf);
    const creditLimit = toMoney(account.creditLimit.toString());

    return {
      buyerAccountId: account.id,
      accountCode: account.accountCode,
      title: account.title,
      creditLimit,
      balance: aging.balance,
      overdue: aging.overdue,
      notDue: aging.notDue,
      buckets: aging.buckets,
      limitUsagePercent: limitUsagePercent(aging.balance, creditLimit),
      averageDueDate: average.averageDueDate,
      averageOverdueDays: average.averageOverdueDays,
      openItems: aging.openItems.map((item) => ({ ...item })),
    };
  }

  /** Donemsel bakiye: aylik borc/alacak + kumulatif bakiye (acilis bakiyesi dahil). */
  async periodicBalance(
    user: RequestUser,
    query: { buyerAccountId?: string; from?: Date; to?: Date },
  ): Promise<{ openingBalance: MoneyString; points: PeriodPoint[] }> {
    const scoped = this.scopeAccount(user, query.buyerAccountId) ?? null;
    const from = query.from ?? null;

    const [opening, rows] = await Promise.all([
      this.repo.openingBalance(scoped, from),
      this.repo.periodTotals(scoped, from, query.to ?? null),
    ]);

    const openingBalance = toMoney(opening);
    let running = openingBalance;

    const points = rows.map((row) => {
      const debit = toMoney(row.debit.toString());
      const credit = toMoney(row.credit.toString());
      running = sub(add(running, debit), credit);
      return { period: row.period, debit, credit, balance: running };
    });

    return { openingBalance, points };
  }

  /** Ortalama vade — tutar agirlikli (acik kalemler uzerinden). */
  async averageDue(user: RequestUser, buyerAccountId: string) {
    const detail = await this.riskDetail(buyerAccountId, user);
    return {
      buyerAccountId: detail.buyerAccountId,
      averageDueDate: detail.averageDueDate,
      averageOverdueDays: detail.averageOverdueDays,
      openBalance: detail.balance,
      overdue: detail.overdue,
    };
  }

  /** PDF servisi bu ham veriyi kullanir. */
  async statementData(buyerAccountId: string, user: RequestUser) {
    const detail = await this.riskDetail(buyerAccountId, user);
    const seller = user.sellerId ? await this.repo.seller(user.sellerId) : null;
    return { detail, sellerName: seller?.name ?? '' };
  }

  /**
   * BUYER_USER yalniz kendi carisini raporlar (§11.2 IDOR).
   * Satici tarafi filtre vermezse tum carileri gorur.
   */
  private scopeAccount(user: RequestUser, requested?: string): string | undefined {
    if (user.role !== UserRole.BUYER_USER) return requested;
    if (!user.buyerAccountId) throw new AppError(ErrorCode.TENANT_FORBIDDEN);
    if (requested && requested !== user.buyerAccountId) {
      throw new AppError(ErrorCode.TENANT_FORBIDDEN);
    }
    return user.buyerAccountId;
  }
}

const toLedgerItem = (row: LedgerItemRow): LedgerItem => ({
  id: row.id,
  type: row.type as TransactionType,
  amount: toMoney(row.amount.toString()),
  documentDate: row.document_date.toISOString().slice(0, 10),
  dueDate: row.due_date ? row.due_date.toISOString().slice(0, 10) : null,
});

function groupByAccount(rows: LedgerItemRow[]): Map<string, LedgerItem[]> {
  const map = new Map<string, LedgerItem[]>();
  for (const row of rows) {
    const list = map.get(row.buyer_account_id) ?? [];
    list.push(toLedgerItem(row));
    map.set(row.buyer_account_id, list);
  }
  return map;
}
