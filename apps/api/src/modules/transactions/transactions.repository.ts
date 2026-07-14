import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { type TransactionListQuery } from '@carinet/shared';
import { PRISMA, type PrismaService, type TxClient } from '../../prisma/prisma.module';

const BUYER_SELECT = { select: { id: true, accountCode: true, title: true } } as const;

/** Kural #3: seller_id filtresi tenant eklentisinden gelir; burada elle yazilmaz. */
@Injectable()
export class TransactionsRepository {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  async findMany(query: TransactionListQuery, skip: number, take: number) {
    const where: Prisma.TransactionWhereInput = {
      ...(query.includeCancelled ? {} : { isCancelled: false }),
      ...(query.buyerAccountId ? { buyerAccountId: query.buyerAccountId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.documentType ? { documentType: query.documentType } : {}),
      ...(query.from || query.to
        ? {
            documentDate: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { documentNo: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take,
        orderBy: [{ documentDate: 'desc' }, { id: 'desc' }],
        include: { buyerAccount: BUYER_SELECT },
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { rows, total };
  }

  findById(id: string) {
    return this.prisma.transaction.findFirst({
      where: { id },
      include: { buyerAccount: BUYER_SELECT },
    });
  }

  create(data: Omit<Prisma.TransactionUncheckedCreateInput, 'sellerId'>, tx?: TxClient) {
    const client = tx ?? this.prisma;
    return client.transaction.create({
      data: data as Prisma.TransactionUncheckedCreateInput,
      include: { buyerAccount: BUYER_SELECT },
    });
  }

  /** Kural #4: silme yok — is_cancelled. */
  cancel(id: string, tx?: TxClient) {
    const client = tx ?? this.prisma;
    return client.transaction.update({ where: { id }, data: { isCancelled: true } });
  }

  /** Fatura iptalinde bagli hareket(ler) de iptal olur — ayni transaction icinde. */
  cancelByInvoice(invoiceId: string, tx: TxClient) {
    return tx.transaction.updateMany({
      where: { invoiceId, isCancelled: false },
      data: { isCancelled: true },
    });
  }
}
