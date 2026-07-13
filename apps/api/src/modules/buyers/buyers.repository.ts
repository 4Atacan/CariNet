import { Inject, Injectable } from '@nestjs/common';
import { PRISMA, type PrismaService } from '../../prisma/prisma.module';

/**
 * Kural #3: burada seller_id filtresi ELLE yazilmaz — tenant guard eklentisi (Prisma) her
 * sorguya baglamdaki seller_id'yi enjekte eder. Baglam yoksa sorgu calismaz.
 * Ayni sebeple findUnique yerine findFirst kullanilir (filtre enjeksiyonu icin).
 */
@Injectable()
export class BuyersRepository {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  async findMany(skip: number, take: number) {
    const [rows, total] = await Promise.all([
      this.prisma.buyerAccount.findMany({
        skip,
        take,
        orderBy: { accountCode: 'asc' },
        include: { representative: { select: { id: true, fullName: true, phone: true } } },
      }),
      this.prisma.buyerAccount.count(),
    ]);
    return { rows, total };
  }

  findById(id: string) {
    return this.prisma.buyerAccount.findFirst({
      where: { id },
      include: { representative: { select: { id: true, fullName: true, phone: true } } },
    });
  }
}
