import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { type InvoiceListQuery } from '@carinet/shared';
import { PRISMA, type PrismaService, type TxClient } from '../../prisma/prisma.module';

const BUYER_SELECT = {
  select: { id: true, accountCode: true, title: true, vknTckn: true },
} as const;

/** Kural #3: seller_id filtresi tenant eklentisinden gelir. */
@Injectable()
export class InvoicesRepository {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  async findMany(query: InvoiceListQuery, skip: number, take: number) {
    const where: Prisma.InvoiceWhereInput = {
      ...(query.includeCancelled ? {} : { isCancelled: false }),
      ...(query.buyerAccountId ? { buyerAccountId: query.buyerAccountId } : {}),
      ...(query.q ? { invoiceNo: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(query.from || query.to
        ? {
            invoiceDate: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: [{ invoiceDate: 'desc' }, { id: 'desc' }],
        include: { buyerAccount: BUYER_SELECT, _count: { select: { items: true } } },
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { rows, total };
  }

  findById(id: string) {
    return this.prisma.invoice.findFirst({
      where: { id },
      include: {
        buyerAccount: BUYER_SELECT,
        items: { orderBy: { lineNo: 'asc' } },
      },
    });
  }

  findByInvoiceNo(invoiceNo: string) {
    return this.prisma.invoice.findFirst({ where: { invoiceNo } });
  }

  create(data: Omit<Prisma.InvoiceUncheckedCreateInput, 'sellerId'>, tx: TxClient) {
    return tx.invoice.create({
      data: data as Prisma.InvoiceUncheckedCreateInput,
      include: { buyerAccount: BUYER_SELECT, items: { orderBy: { lineNo: 'asc' } } },
    });
  }

  /** Kural #4: fatura silinmez — iptal edilir. */
  cancel(id: string, tx: TxClient) {
    return tx.invoice.update({ where: { id }, data: { isCancelled: true } });
  }
}
