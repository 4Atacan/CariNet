import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { type BuyerListQuery } from '@carinet/shared';
import { PRISMA, type PrismaService, type TxClient } from '../../prisma/prisma.module';

const REPRESENTATIVE_SELECT = { select: { id: true, fullName: true, phone: true } } as const;

/**
 * Kural #3: burada seller_id filtresi ELLE yazilmaz — tenant guard eklentisi (Prisma) her
 * sorguya baglamdaki seller_id'yi enjekte eder. Baglam yoksa sorgu calismaz.
 * Ayni sebeple findUnique yerine findFirst kullanilir (filtre enjeksiyonu icin).
 */
@Injectable()
export class BuyersRepository {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  async findMany(query: BuyerListQuery, skip: number, take: number) {
    const where: Prisma.BuyerAccountWhereInput = {
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.representativeId ? { representativeId: query.representativeId } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { accountCode: { contains: query.q, mode: 'insensitive' } },
              { vknTckn: { contains: query.q } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.buyerAccount.findMany({
        where,
        skip,
        take,
        orderBy: { accountCode: 'asc' },
        include: { representative: REPRESENTATIVE_SELECT },
      }),
      this.prisma.buyerAccount.count({ where }),
    ]);
    return { rows, total };
  }

  findById(id: string) {
    return this.prisma.buyerAccount.findFirst({
      where: { id },
      include: {
        representative: REPRESENTATIVE_SELECT,
        _count: { select: { memberships: true, transactions: true } },
      },
    });
  }

  findByAccountCode(accountCode: string) {
    return this.prisma.buyerAccount.findFirst({ where: { accountCode } });
  }

  create(data: Omit<Prisma.BuyerAccountUncheckedCreateInput, 'sellerId'>, tx?: TxClient) {
    const client = tx ?? this.prisma;
    return client.buyerAccount.create({
      data: data as Prisma.BuyerAccountUncheckedCreateInput,
      include: { representative: REPRESENTATIVE_SELECT },
    });
  }

  update(id: string, data: Prisma.BuyerAccountUncheckedUpdateInput) {
    return this.prisma.buyerAccount.update({
      where: { id },
      data,
      include: { representative: REPRESENTATIVE_SELECT },
    });
  }

  /** Havale aciklamalari eski kodla gelebilir (§7 account_code_history). */
  recordCodeChange(buyerAccountId: string, oldCode: string) {
    return this.prisma.accountCodeHistory.create({ data: { buyerAccountId, oldCode } });
  }

  listCodeHistory(buyerAccountId: string) {
    return this.prisma.accountCodeHistory.findMany({
      where: { buyerAccountId },
      orderBy: { changedAt: 'desc' },
    });
  }

  /** Mobil Dashboard: son 10 hareket (§13 Faz 1). */
  recentTransactions(buyerAccountId: string, take = 10) {
    return this.prisma.transaction.findMany({
      where: { buyerAccountId, isCancelled: false },
      orderBy: [{ documentDate: 'desc' }, { id: 'desc' }],
      take,
    });
  }
}
