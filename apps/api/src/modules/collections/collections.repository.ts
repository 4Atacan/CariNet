import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { type IntentListQuery } from '@carinet/shared';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PRISMA, type PrismaService, type TxClient } from '../../prisma/prisma.module';

/**
 * Kural #3: CollectIntent / BankStatementRow / Transaction tenant modelidir → seller_id
 * eklentiden gelir. Yalniz misafir ve POS callback yollari tenant baglami OLMADAN baslar;
 * onlar `runAsSystem` ile satiriyi bulup baglami kurar (§6.1).
 */
@Injectable()
export class CollectionsRepository {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- intent

  createIntent(data: Omit<Prisma.CollectIntentUncheckedCreateInput, 'sellerId'>, tx?: TxClient) {
    return (tx ?? this.prisma).collectIntent.create({
      data: data as Prisma.CollectIntentUncheckedCreateInput,
    });
  }

  findIntent(id: string, tx?: TxClient) {
    return (tx ?? this.prisma).collectIntent.findFirst({
      where: { id },
      include: { buyerAccount: { select: { id: true, accountCode: true, title: true } } },
    });
  }

  /** Referans kodu KURESEL benzersizdir → callback/misafir yolunda satici bulunur. */
  findIntentByReference(referenceCode: string) {
    return TenantContext.runAsSystem(() =>
      this.prisma.collectIntent.findUnique({ where: { referenceCode } }),
    );
  }

  async listIntents(query: IntentListQuery, skip: number, take: number) {
    const where: Prisma.CollectIntentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.buyerAccountId ? { buyerAccountId: query.buyerAccountId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.collectIntent.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { buyerAccount: { select: { id: true, accountCode: true, title: true } } },
      }),
      this.prisma.collectIntent.count({ where }),
    ]);
    return { rows, total };
  }

  /** Bekleyen intentler — ekstre eslestirmesinin havuzu. */
  pendingIntents(tx?: TxClient) {
    return (tx ?? this.prisma).collectIntent.findMany({
      where: { status: 'PENDING', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Compare-and-set: YALNIZ PENDING iken CONFIRMED'e cevirir.
   * Iki es zamanli onay yarissa (manuel + ekstre, ya da iki callback) yalniz biri 1 doner;
   * digeri 0 alir ve hicbir sey yazmaz → cift CREDIT imkansiz.
   */
  async confirmIfPending(
    id: string,
    data: { confirmedById: string | null; providerRef?: string; statementRowId?: string },
    tx: TxClient,
  ): Promise<boolean> {
    const result = await tx.collectIntent.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmedById: data.confirmedById,
        ...(data.providerRef ? { providerRef: data.providerRef } : {}),
      },
    });
    return result.count === 1;
  }

  cancelIntent(id: string) {
    return this.prisma.collectIntent.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  }

  /** Cron: suresi dolan bekleyen talepler (TUM saticilar → sistem modu). */
  expirePending() {
    return TenantContext.runAsSystem(() =>
      this.prisma.collectIntent.updateMany({
        where: { status: 'PENDING', expiresAt: { lte: new Date() } },
        data: { status: 'EXPIRED' },
      }),
    );
  }

  // ---------------------------------------------------------------- CREDIT hareketi

  createCredit(data: Omit<Prisma.TransactionUncheckedCreateInput, 'sellerId'>, tx: TxClient) {
    return tx.transaction.create({ data: data as Prisma.TransactionUncheckedCreateInput });
  }

  /** Idempotency: bu intent'e bagli iptal edilmemis CREDIT zaten var mi? */
  findCreditOfIntent(intentId: string, tx: TxClient) {
    return tx.transaction.findFirst({
      where: { collectIntentId: intentId, isCancelled: false },
    });
  }

  // ---------------------------------------------------------------- banka ekstresi

  createStatementBatch(data: Omit<Prisma.ImportBatchUncheckedCreateInput, 'sellerId'>) {
    return this.prisma.importBatch.create({
      data: data as Prisma.ImportBatchUncheckedCreateInput,
    });
  }

  createStatementRows(
    rows: Omit<Prisma.BankStatementRowUncheckedCreateInput, 'sellerId'>[],
    tx?: TxClient,
  ) {
    return (tx ?? this.prisma).bankStatementRow.createManyAndReturn({
      data: rows as Prisma.BankStatementRowUncheckedCreateInput[],
    });
  }

  statementRows(importId: string, tx?: TxClient) {
    return (tx ?? this.prisma).bankStatementRow.findMany({
      where: { importId },
      orderBy: { rowNo: 'asc' },
    });
  }

  findStatementRow(id: string, tx: TxClient) {
    return tx.bankStatementRow.findFirst({ where: { id } });
  }

  /**
   * Satiri intent'e baglar. matched_intent_id UNIQUE → ayni intent iki satira baglanamaz;
   * satir zaten bagliysa updateMany 0 doner (DB seviyesinde cift-onay kilidi, §11.3).
   */
  async matchStatementRow(rowId: string, intentId: string, tx: TxClient): Promise<boolean> {
    const result = await tx.bankStatementRow.updateMany({
      where: { id: rowId, matchedIntentId: null },
      data: { matchedIntentId: intentId },
    });
    return result.count === 1;
  }

  updateBatch(id: string, data: Prisma.ImportBatchUncheckedUpdateInput, tx?: TxClient) {
    return (tx ?? this.prisma).importBatch.update({ where: { id }, data });
  }

  findBatch(id: string) {
    return this.prisma.importBatch.findFirst({ where: { id, target: 'BANK_STATEMENT' } });
  }

  // ---------------------------------------------------------------- yardimci sorgular

  /** Guncel cari kodlari + eski kodlar (havale aciklamasi eski kodla gelebilir — §7). */
  async accountCodes(tx?: TxClient) {
    const client = tx ?? this.prisma;
    const accounts = await client.buyerAccount.findMany({
      select: { id: true, accountCode: true, title: true, isActive: true },
    });
    const history = await client.accountCodeHistory.findMany({
      where: { buyerAccountId: { in: accounts.map((a) => a.id) } },
      select: { buyerAccountId: true, oldCode: true },
    });
    return { accounts, history };
  }

  findAccountByCode(accountCode: string) {
    return this.prisma.buyerAccount.findFirst({ where: { accountCode } });
  }

  findAccount(id: string, tx?: TxClient) {
    return (tx ?? this.prisma).buyerAccount.findFirst({ where: { id } });
  }

  activeBankAccounts() {
    return this.prisma.sellerBankAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  activePosConfig(tx?: TxClient) {
    return (tx ?? this.prisma).sellerPosConfig.findFirst({ where: { isActive: true } });
  }

  /** Referans kodu icin satici numarasi (§7). Seller tenant modeli DEGIL → id ile okunur. */
  seller(sellerId: string) {
    return TenantContext.runAsSystem(() =>
      this.prisma.seller.findUnique({
        where: { id: sellerId },
        select: { id: true, sellerNo: true, name: true, slug: true, logoUrl: true, isActive: true },
      }),
    );
  }

  sellerBySlug(slug: string) {
    return TenantContext.runAsSystem(() =>
      this.prisma.seller.findUnique({
        where: { slug },
        select: { id: true, sellerNo: true, name: true, slug: true, logoUrl: true, isActive: true },
      }),
    );
  }

  /** Bildirim: cariye bagli TUM kullanicilar (coklu uyelik — §6.2). */
  membersOfAccount(buyerAccountId: string, tx: TxClient) {
    return tx.accountMembership.findMany({
      where: { buyerAccountId },
      select: { userId: true },
    });
  }
}
