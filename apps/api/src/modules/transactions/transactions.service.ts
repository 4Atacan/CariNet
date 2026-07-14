import { Injectable } from '@nestjs/common';
import { type Transaction } from '@prisma/client';
import {
  AppError,
  ErrorCode,
  UserRole,
  paginate,
  toMoney,
  toRate,
  type CreateTransactionInput,
  type DocumentType,
  type MoneyString,
  type TransactionListQuery,
  type TransactionType,
} from '@carinet/shared';
import { AuditService } from '../../common/audit/audit.service';
import { Paginated } from '../../common/dto/paginated';
import { type RequestUser } from '../../common/types/request-with-user';
import { BuyersService } from '../buyers/buyers.service';
import { TransactionsRepository } from './transactions.repository';

type TransactionWithBuyer = Transaction & {
  buyerAccount: { id: string; accountCode: string; title: string };
};

@Injectable()
export class TransactionsService {
  constructor(
    private readonly repo: TransactionsRepository,
    private readonly buyers: BuyersService,
    private readonly audit: AuditService,
  ) {}

  async list(query: TransactionListQuery, user: RequestUser) {
    // BUYER_USER yalniz kendi carisinin hareketlerini gorur (§11.2 IDOR).
    const scoped: TransactionListQuery =
      user.role === UserRole.BUYER_USER
        ? { ...query, buyerAccountId: user.buyerAccountId ?? '' }
        : query;

    const { skip, take } = paginate(scoped.page, scoped.limit);
    const { rows, total } = await this.repo.findMany(scoped, skip, take);
    return Paginated.of(rows.map(toTransactionDto), scoped.page, scoped.limit, total);
  }

  async findOne(id: string, user: RequestUser) {
    const row = await this.repo.findById(id);
    if (!row) throw new AppError(ErrorCode.NOT_FOUND);
    if (user.role === UserRole.BUYER_USER && row.buyerAccountId !== user.buyerAccountId) {
      throw new AppError(ErrorCode.TENANT_FORBIDDEN);
    }
    return toTransactionDto(row);
  }

  /** Tekil hareket girisi (panel). Tutar daima pozitif; yon `type` ile (kural #2). */
  async create(input: CreateTransactionInput, user: RequestUser) {
    await this.buyers.requireActiveAccount(input.buyerAccountId);

    const row = await this.repo.create({
      buyerAccountId: input.buyerAccountId,
      type: input.type,
      documentType: input.documentType,
      documentNo: input.documentNo,
      documentDate: input.documentDate,
      dueDate: input.dueDate,
      amount: input.amount,
      currencyCode: input.currencyCode,
      exchangeRate: input.exchangeRate,
      description: input.description,
      createdById: user.userId,
    });

    await this.audit.log({
      action: 'CREATE',
      entity: 'Transaction',
      entityId: row.id,
      after: row,
    });
    return toTransactionDto(row);
  }

  /**
   * Kural #4: finansal kayit SILINMEZ. Iptal → bakiyeden dusme + audit.
   * Faturaya bagli hareket tek basina iptal edilemez (fatura iptali ile birlikte iptal olur).
   */
  async cancel(id: string, reason: string, user: RequestUser) {
    const before = await this.repo.findById(id);
    if (!before) throw new AppError(ErrorCode.NOT_FOUND);
    if (before.isCancelled) {
      throw new AppError(ErrorCode.CONFLICT, 'Hareket zaten iptal edilmis');
    }
    if (before.invoiceId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Faturaya bagli hareket tek basina iptal edilemez; faturayi iptal edin',
      );
    }
    if (before.collectIntentId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Tahsilata bagli hareket tek basina iptal edilemez',
      );
    }

    await this.repo.cancel(id);
    await this.audit.log({
      action: 'CANCEL',
      entity: 'Transaction',
      entityId: id,
      before: { isCancelled: false },
      after: { isCancelled: true, reason, cancelledBy: user.userId },
    });
    return { id, isCancelled: true };
  }
}

export interface TransactionDto {
  id: string;
  buyerAccountId: string;
  buyerAccount: { id: string; accountCode: string; title: string };
  type: TransactionType;
  documentType: DocumentType;
  documentNo: string | null;
  documentDate: string;
  dueDate: string | null;
  amount: MoneyString;
  currencyCode: string;
  exchangeRate: MoneyString;
  description: string | null;
  invoiceId: string | null;
  isCancelled: boolean;
  createdAt: Date;
}

/** Decimal/Date → tasima tipleri (kural #1: sinirdan number cikmaz). */
export function toTransactionDto(row: TransactionWithBuyer): TransactionDto {
  return {
    id: row.id,
    buyerAccountId: row.buyerAccountId,
    buyerAccount: row.buyerAccount,
    type: row.type as TransactionType,
    documentType: row.documentType as DocumentType,
    documentNo: row.documentNo,
    documentDate: toIsoDate(row.documentDate),
    dueDate: row.dueDate ? toIsoDate(row.dueDate) : null,
    amount: toMoney(row.amount.toString()),
    currencyCode: row.currencyCode.trim(),
    exchangeRate: toRate(row.exchangeRate.toString()),
    description: row.description,
    invoiceId: row.invoiceId,
    isCancelled: row.isCancelled,
    createdAt: row.createdAt,
  };
}

const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);
