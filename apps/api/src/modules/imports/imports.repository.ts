import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { type ImportRowsQuery } from '@carinet/shared';
import { PRISMA, type PrismaService, type TxClient } from '../../prisma/prisma.module';

/** Kural #3: seller_id tenant eklentisinden gelir (ImportBatch/ImportTemplate tenant modeli). */
@Injectable()
export class ImportsRepository {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  createBatch(data: Omit<Prisma.ImportBatchUncheckedCreateInput, 'sellerId'>) {
    return this.prisma.importBatch.create({
      data: data as Prisma.ImportBatchUncheckedCreateInput,
    });
  }

  /** ImportRow tenant modeli DEGILDIR (seller_id yok) — batch uzerinden dogrulanir. */
  createRows(rows: Prisma.ImportRowUncheckedCreateInput[]) {
    return this.prisma.importRow.createMany({ data: rows });
  }

  findBatch(id: string) {
    return this.prisma.importBatch.findFirst({ where: { id } });
  }

  async listBatches(skip: number, take: number) {
    const [rows, total] = await Promise.all([
      this.prisma.importBatch.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { rows: true } } },
      }),
      this.prisma.importBatch.count(),
    ]);
    return { rows, total };
  }

  /** Ayni dosya daha once yuklendi mi? (§6.6 mukerrer uyarisi) */
  findByHash(fileHash: string) {
    return this.prisma.importBatch.findFirst({
      where: { fileHash, status: { in: ['PARSED', 'COMMITTED'] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listRows(batchId: string, query: ImportRowsQuery, skip: number, take: number) {
    const where: Prisma.ImportRowWhereInput = {
      batchId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.importRow.findMany({ where, skip, take, orderBy: { rowNo: 'asc' } }),
      this.prisma.importRow.count({ where }),
    ]);
    return { rows, total };
  }

  allRows(batchId: string, tx: TxClient) {
    return tx.importRow.findMany({ where: { batchId }, orderBy: { rowNo: 'asc' } });
  }

  updateBatch(id: string, data: Prisma.ImportBatchUncheckedUpdateInput, tx?: TxClient) {
    return (tx ?? this.prisma).importBatch.update({ where: { id }, data });
  }

  markRowsCommitted(batchId: string, tx: TxClient) {
    return tx.importRow.updateMany({
      where: { batchId, status: 'VALID' },
      data: { status: 'COMMITTED' },
    });
  }

  /** §6.6 — batch iptali: bagli finansal kayitlara TOPLU is_cancelled (silme yok, kural #4). */
  cancelBatchTransactions(batchId: string, tx: TxClient) {
    return tx.transaction.updateMany({
      where: { importBatchId: batchId, isCancelled: false },
      data: { isCancelled: true },
    });
  }

  // ---------------------------------------------------------------- sablonlar (§9)

  listTemplates() {
    return this.prisma.importTemplate.findMany({ orderBy: { name: 'asc' } });
  }

  findTemplate(id: string) {
    return this.prisma.importTemplate.findFirst({ where: { id } });
  }

  createTemplate(data: Omit<Prisma.ImportTemplateUncheckedCreateInput, 'sellerId'>) {
    return this.prisma.importTemplate.create({
      data: data as Prisma.ImportTemplateUncheckedCreateInput,
    });
  }

  // ---------------------------------------------------------------- commit yardimcilari

  /** Cari kodu / VKN → id eslesmesi (§9: VKN altin anahtar). Tenant filtresi eklentiden. */
  accountsForMatching(tx: TxClient) {
    return tx.buyerAccount.findMany({
      select: { id: true, accountCode: true, vknTckn: true, isActive: true },
    });
  }

  createAccount(data: Omit<Prisma.BuyerAccountUncheckedCreateInput, 'sellerId'>, tx: TxClient) {
    return tx.buyerAccount.create({
      data: data as Prisma.BuyerAccountUncheckedCreateInput,
    });
  }

  createTransactions(
    data: Omit<Prisma.TransactionUncheckedCreateInput, 'sellerId'>[],
    tx: TxClient,
  ) {
    return tx.transaction.createMany({ data: data as Prisma.TransactionUncheckedCreateInput[] });
  }

  createInvoice(data: Omit<Prisma.InvoiceUncheckedCreateInput, 'sellerId'>, tx: TxClient) {
    return tx.invoice.create({ data: data as Prisma.InvoiceUncheckedCreateInput });
  }

  /** Devir kaydi zaten var mi? (Ayni cariye iki kez devir girilemez — §9.) */
  existingOpeningBalances(buyerAccountIds: string[], tx: TxClient) {
    return tx.transaction.findMany({
      where: {
        buyerAccountId: { in: buyerAccountIds },
        documentType: 'OPENING_BALANCE',
        isCancelled: false,
      },
      select: { buyerAccountId: true },
    });
  }

  existingInvoiceNos(invoiceNos: string[], tx: TxClient) {
    return tx.invoice.findMany({
      where: { invoiceNo: { in: invoiceNos } },
      select: { invoiceNo: true },
    });
  }
}
