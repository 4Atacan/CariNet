import { Inject, Injectable } from '@nestjs/common';
import { type Product, type Stock } from '@prisma/client';
import {
  AppError,
  ErrorCode,
  UserRole,
  paginate,
  toMoney,
  type CreateProductInput,
  type MoneyString,
  type ProductListQuery,
  type SetStockInput,
  type UpdateProductInput,
} from '@carinet/shared';
import { AuditService } from '../../common/audit/audit.service';
import { Paginated } from '../../common/dto/paginated';
import { type RequestUser } from '../../common/types/request-with-user';
import { PRISMA, type PrismaService } from '../../prisma/prisma.module';
import { ProductsRepository } from './products.repository';

type ProductWithStock = Product & {
  stock: Pick<Stock, 'quantity' | 'updatedAt'> | null;
};

@Injectable()
export class ProductsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaService,
    private readonly repo: ProductsRepository,
    private readonly audit: AuditService,
  ) {}

  /** Mobil vitrin yalniz AKTIF urunleri gorur; panel hepsini. */
  async list(query: ProductListQuery, user: RequestUser) {
    const scoped: ProductListQuery =
      user.role === UserRole.BUYER_USER ? { ...query, onlyActive: true } : query;

    const { skip, take } = paginate(scoped.page, scoped.limit);
    const { rows, total } = await this.repo.findMany(scoped, skip, take);
    return Paginated.of(rows.map(toProductDto), scoped.page, scoped.limit, total);
  }

  async findOne(id: string, user: RequestUser) {
    const product = await this.repo.findById(id);
    if (!product) throw new AppError(ErrorCode.NOT_FOUND);
    if (user.role === UserRole.BUYER_USER && !product.isActive) {
      throw new AppError(ErrorCode.NOT_FOUND);
    }
    return toProductDto(product);
  }

  /** Urun + acilis stogu TEK transaction'da (yarim urun kalmasin). */
  async create(input: CreateProductInput) {
    const clash = await this.repo.findByCode(input.code);
    if (clash) throw new AppError(ErrorCode.CONFLICT, 'Bu urun kodu zaten kullaniliyor');

    const created = await this.prisma.$transaction(async (tx) => {
      const product = await this.repo.create(
        {
          code: input.code,
          name: input.name,
          unit: input.unit,
          price: input.price,
          currencyCode: input.currencyCode,
          imageUrl: input.imageUrl,
          isActive: input.isActive,
        },
        tx,
      );
      if (input.quantity) await this.repo.setStock(product.id, input.quantity, tx);
      return product;
    });

    await this.audit.log({
      action: 'CREATE',
      entity: 'Product',
      entityId: created.id,
      after: created,
    });
    const full = await this.repo.findById(created.id);
    return toProductDto(full!);
  }

  async update(id: string, input: UpdateProductInput) {
    const before = await this.repo.findById(id);
    if (!before) throw new AppError(ErrorCode.NOT_FOUND);

    if (input.code && input.code !== before.code) {
      const clash = await this.repo.findByCode(input.code);
      if (clash) throw new AppError(ErrorCode.CONFLICT, 'Bu urun kodu zaten kullaniliyor');
    }

    const after = await this.repo.update(id, input);
    await this.audit.log({ action: 'UPDATE', entity: 'Product', entityId: id, before, after });
    return toProductDto(after);
  }

  /**
   * Urun finansal kayit DEGILDIR (kural #4 kapsaminda hard delete serbest) — ama vitrinde
   * gorunmesin diye PASIFE almak yeterli ve geri alinabilir. Silme ucu YOK.
   */
  async setActive(id: string, isActive: boolean) {
    const before = await this.repo.findById(id);
    if (!before) throw new AppError(ErrorCode.NOT_FOUND);

    const after = await this.repo.update(id, { isActive });
    await this.audit.log({
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
      entity: 'Product',
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive },
    });
    return toProductDto(after);
  }

  async setStock(id: string, input: SetStockInput) {
    const product = await this.repo.findById(id);
    if (!product) throw new AppError(ErrorCode.NOT_FOUND);

    await this.repo.setStock(id, input.quantity);
    await this.audit.log({
      action: 'STOCK_SET',
      entity: 'Stock',
      entityId: id,
      before: { quantity: product.stock?.quantity.toString() ?? '0' },
      after: { quantity: input.quantity },
    });

    const after = await this.repo.findById(id);
    return toProductDto(after!);
  }
}

export interface ProductDto {
  id: string;
  code: string;
  name: string;
  unit: string;
  price: MoneyString | null;
  currencyCode: string;
  imageUrl: string | null;
  isActive: boolean;
  quantity: string;
  stockUpdatedAt: Date | null;
}

/** Decimal → string (kural #1: sinirdan number cikmaz). */
function toProductDto(row: ProductWithStock): ProductDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    unit: row.unit,
    price: row.price ? toMoney(row.price.toString()) : null,
    currencyCode: row.currencyCode.trim(),
    imageUrl: row.imageUrl,
    isActive: row.isActive,
    quantity: row.stock?.quantity.toString() ?? '0',
    stockUpdatedAt: row.stock?.updatedAt ?? null,
  };
}
