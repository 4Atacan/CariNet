import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { type ProductListQuery } from '@carinet/shared';
import { PRISMA, type PrismaService, type TxClient } from '../../prisma/prisma.module';

/** Product / Stock tenant modelidir → seller_id eklentiden gelir (kural #3). */
@Injectable()
export class ProductsRepository {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  async findMany(query: ProductListQuery, skip: number, take: number) {
    const where: Prisma.ProductWhereInput = {
      ...(query.onlyActive ? { isActive: true } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.inStock ? { stock: { quantity: { gt: 0 } } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: { stock: { select: { quantity: true, updatedAt: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { rows, total };
  }

  findById(id: string) {
    return this.prisma.product.findFirst({
      where: { id },
      include: { stock: { select: { quantity: true, updatedAt: true } } },
    });
  }

  findByCode(code: string) {
    return this.prisma.product.findFirst({ where: { code } });
  }

  create(data: Omit<Prisma.ProductUncheckedCreateInput, 'sellerId'>, tx?: TxClient) {
    return (tx ?? this.prisma).product.create({
      data: data as Prisma.ProductUncheckedCreateInput,
    });
  }

  update(id: string, data: Prisma.ProductUncheckedUpdateInput) {
    return this.prisma.product.update({
      where: { id },
      data,
      include: { stock: { select: { quantity: true, updatedAt: true } } },
    });
  }

  /** Stok MUTLAK yazilir (sayim sonucu) — artirma/azaltma degil. */
  setStock(productId: string, quantity: string, tx?: TxClient) {
    const client = tx ?? this.prisma;
    return client.stock.upsert({
      where: { productId },
      create: { productId, quantity } as Prisma.StockUncheckedCreateInput,
      update: { quantity },
    });
  }
}
