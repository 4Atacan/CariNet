import { Injectable } from '@nestjs/common';
import {
  DEFAULT_CURRENCY,
  TransactionType,
  sub,
  toMoney,
  type DocumentType,
  type MoneyString,
} from '@carinet/shared';
import { LedgerRepository, type StatementFilter, type StatementRawRow } from './ledger.repository';

export interface StatementLine {
  id: string;
  type: TransactionType;
  documentType: DocumentType;
  documentNo: string | null;
  documentDate: string;
  dueDate: string | null;
  /** Belge para biriminde tutar. */
  amount: MoneyString;
  currencyCode: string;
  exchangeRate: MoneyString;
  /** TRY karsiligi (kur satira sabit — §7). TRY satirda amount ile aynidir. */
  amountTry: MoneyString;
  description: string | null;
  invoiceId: string | null;
  /** Kural #2: saklanmaz, sorgu aninda window function ile turetilir (§6.4). TRY. */
  runningBalance: MoneyString;
}

export interface AccountBalance {
  totalDebit: MoneyString;
  totalCredit: MoneyString;
  /** Bakiye = Σ(DEBIT) − Σ(CREDIT), TRY. Pozitif = alici borclu. */
  balance: MoneyString;
  currencyCode: string;
}

const ZERO_BALANCE: AccountBalance = {
  totalDebit: '0.00',
  totalCredit: '0.00',
  balance: '0.00',
  currencyCode: DEFAULT_CURRENCY,
};

/**
 * Bakiye TURETILIR, saklanmaz (kural #2). Tek bakiye kaynagi burasidir:
 * cari listesi, ekstre, fatura ekrani ve raporlar bu servisi kullanir.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly repo: LedgerRepository) {}

  async statement(buyerAccountId: string, filter: StatementFilter) {
    const [rows, total] = await Promise.all([
      this.repo.statement(buyerAccountId, filter),
      this.repo.statementCount(buyerAccountId, filter.from, filter.to),
    ]);
    return { rows: rows.map(toStatementLine), total };
  }

  async balanceOf(buyerAccountId: string): Promise<AccountBalance> {
    const balances = await this.balancesOf([buyerAccountId]);
    return balances.get(buyerAccountId) ?? ZERO_BALANCE;
  }

  /** Cari listesi icin toplu bakiye. */
  async balancesOf(buyerAccountIds: string[]): Promise<Map<string, AccountBalance>> {
    const result = new Map<string, AccountBalance>();
    if (buyerAccountIds.length === 0) return result;

    const rows = await this.repo.sumsByAccount(buyerAccountIds);
    for (const id of buyerAccountIds) {
      const row = rows.find((r) => r.buyer_account_id === id);
      if (!row) {
        result.set(id, ZERO_BALANCE);
        continue;
      }
      const totalDebit = toMoney(row.total_debit.toString());
      const totalCredit = toMoney(row.total_credit.toString());
      result.set(id, {
        totalDebit,
        totalCredit,
        balance: sub(totalDebit, totalCredit),
        currencyCode: DEFAULT_CURRENCY,
      });
    }
    return result;
  }
}

function toStatementLine(row: StatementRawRow): StatementLine {
  return {
    id: row.id,
    type: row.type as TransactionType,
    documentType: row.document_type as DocumentType,
    documentNo: row.document_no,
    documentDate: toIsoDate(row.document_date),
    dueDate: row.due_date ? toIsoDate(row.due_date) : null,
    amount: toMoney(row.amount.toString()),
    currencyCode: row.currency_code.trim(),
    exchangeRate: row.exchange_rate.toString(),
    amountTry: toMoney(row.amount_try.toString()),
    description: row.description,
    invoiceId: row.invoice_id,
    runningBalance: toMoney(row.running_balance.toString()),
  };
}

const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);
