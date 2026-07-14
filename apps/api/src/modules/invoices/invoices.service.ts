import { Inject, Injectable } from '@nestjs/common';
import { type Invoice, type InvoiceItem } from '@prisma/client';
import {
  AppError,
  DocumentType,
  ErrorCode,
  TransactionType,
  UserRole,
  computeInvoiceTotals,
  paginate,
  toMoney,
  toRate,
  type CreateInvoiceInput,
  type InvoiceListQuery,
  type MoneyString,
} from '@carinet/shared';
import { AuditService } from '../../common/audit/audit.service';
import { Paginated } from '../../common/dto/paginated';
import { type RequestUser } from '../../common/types/request-with-user';
import { PRISMA, type PrismaService } from '../../prisma/prisma.module';
import { BuyersService } from '../buyers/buyers.service';
import { TransactionsRepository } from '../transactions/transactions.repository';
import { InvoicesRepository } from './invoices.repository';

type BuyerRef = { id: string; accountCode: string; title: string; vknTckn: string | null };
type InvoiceWithItems = Invoice & { buyerAccount: BuyerRef; items: InvoiceItem[] };

@Injectable()
export class InvoicesService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaService,
    private readonly repo: InvoicesRepository,
    private readonly transactions: TransactionsRepository,
    private readonly buyers: BuyersService,
    private readonly audit: AuditService,
  ) {}

  async list(query: InvoiceListQuery, user: RequestUser) {
    const scoped: InvoiceListQuery =
      user.role === UserRole.BUYER_USER
        ? { ...query, buyerAccountId: user.buyerAccountId ?? '' }
        : query;

    const { skip, take } = paginate(scoped.page, scoped.limit);
    const { rows, total } = await this.repo.findMany(scoped, skip, take);

    const data = rows.map(({ _count, ...row }) => ({
      ...toInvoiceSummary(row),
      itemCount: _count.items,
    }));
    return Paginated.of(data, scoped.page, scoped.limit, total);
  }

  /** Fatura detayi — kalemler + satir bazli kur (§13 Faz 1 mobil). */
  async findOne(id: string, user: RequestUser) {
    const invoice = await this.repo.findById(id);
    if (!invoice) throw new AppError(ErrorCode.NOT_FOUND);
    if (user.role === UserRole.BUYER_USER && invoice.buyerAccountId !== user.buyerAccountId) {
      throw new AppError(ErrorCode.TENANT_FORBIDDEN);
    }
    return toInvoiceDto(invoice);
  }

  /**
   * Fatura + kalemler + DEBIT hareketi TEK DB transaction'inda yazilir.
   * Toplamlar istemciden ALINMAZ, decimal.js ile burada hesaplanir (kural #1).
   */
  async create(input: CreateInvoiceInput, user: RequestUser) {
    await this.buyers.requireActiveAccount(input.buyerAccountId);

    const clash = await this.repo.findByInvoiceNo(input.invoiceNo);
    if (clash) throw new AppError(ErrorCode.CONFLICT, 'Bu fatura numarasi zaten kayitli');

    const totals = computeInvoiceTotals(input.items);

    const invoice = await this.prisma.$transaction(async (tx) => {
      const created = await this.repo.create(
        {
          buyerAccountId: input.buyerAccountId,
          invoiceNo: input.invoiceNo,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate,
          currencyCode: input.currencyCode,
          exchangeRate: input.exchangeRate,
          netTotal: totals.netTotal,
          taxTotal: totals.taxTotal,
          grandTotal: totals.grandTotal,
          items: {
            create: input.items.map((item, index) => ({
              lineNo: index + 1,
              name: item.name,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate,
              netTotal: totals.lines[index]!.netTotal,
              taxAmount: totals.lines[index]!.taxAmount,
              lineTotal: totals.lines[index]!.lineTotal,
              exchangeRate: input.exchangeRate,
            })),
          },
        },
        tx,
      );

      // Fatura = alici borclanir → DEBIT (kural #2: bakiye bu hareketten turer).
      await this.transactions.create(
        {
          buyerAccountId: input.buyerAccountId,
          type: TransactionType.DEBIT,
          documentType: DocumentType.SALES_INVOICE,
          documentNo: input.invoiceNo,
          documentDate: input.invoiceDate,
          dueDate: input.dueDate,
          amount: totals.grandTotal,
          currencyCode: input.currencyCode,
          exchangeRate: input.exchangeRate,
          description: input.description ?? 'Satis faturasi',
          invoiceId: created.id,
          createdById: user.userId,
        },
        tx,
      );

      await this.audit.log(
        { action: 'CREATE', entity: 'Invoice', entityId: created.id, after: created },
        tx,
      );
      return created;
    });

    return toInvoiceDto(invoice);
  }

  /** Kural #4: fatura silinmez — iptal edilir, bagli DEBIT hareketi de ayni islemde iptal olur. */
  async cancel(id: string, reason: string, user: RequestUser) {
    const before = await this.repo.findById(id);
    if (!before) throw new AppError(ErrorCode.NOT_FOUND);
    if (before.isCancelled) throw new AppError(ErrorCode.CONFLICT, 'Fatura zaten iptal edilmis');

    await this.prisma.$transaction(async (tx) => {
      await this.repo.cancel(id, tx);
      await this.transactions.cancelByInvoice(id, tx);
      await this.audit.log(
        {
          action: 'CANCEL',
          entity: 'Invoice',
          entityId: id,
          before: { isCancelled: false },
          after: { isCancelled: true, reason, cancelledBy: user.userId },
        },
        tx,
      );
    });

    return { id, isCancelled: true };
  }
}

export interface InvoiceSummaryDto {
  id: string;
  buyerAccountId: string;
  buyerAccount: BuyerRef;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  currencyCode: string;
  exchangeRate: MoneyString;
  netTotal: MoneyString;
  taxTotal: MoneyString;
  grandTotal: MoneyString;
  isCancelled: boolean;
}

function toInvoiceSummary(row: Invoice & { buyerAccount: BuyerRef }): InvoiceSummaryDto {
  return {
    id: row.id,
    buyerAccountId: row.buyerAccountId,
    buyerAccount: row.buyerAccount,
    invoiceNo: row.invoiceNo,
    invoiceDate: toIsoDate(row.invoiceDate),
    dueDate: row.dueDate ? toIsoDate(row.dueDate) : null,
    currencyCode: row.currencyCode.trim(),
    exchangeRate: toRate(row.exchangeRate.toString()),
    netTotal: toMoney(row.netTotal.toString()),
    taxTotal: toMoney(row.taxTotal.toString()),
    grandTotal: toMoney(row.grandTotal.toString()),
    isCancelled: row.isCancelled,
  };
}

function toInvoiceDto(row: InvoiceWithItems) {
  return {
    ...toInvoiceSummary(row),
    items: row.items.map((item) => ({
      id: item.id,
      lineNo: item.lineNo,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity.toString(),
      unitPrice: toMoney(item.unitPrice.toString()),
      taxRate: item.taxRate.toString(),
      netTotal: toMoney(item.netTotal.toString()),
      taxAmount: toMoney(item.taxAmount.toString()),
      lineTotal: toMoney(item.lineTotal.toString()),
      /** Satir bazli kur (§7). */
      exchangeRate: toRate(item.exchangeRate.toString()),
    })),
  };
}

const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);
