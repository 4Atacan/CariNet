import { Injectable } from '@nestjs/common';
import { AppError, ErrorCode, UserRole, paginate, type PaginationQuery } from '@carinet/shared';
import { Paginated } from '../../common/dto/paginated';
import { type RequestUser } from '../../common/types/request-with-user';
import { BuyersRepository } from './buyers.repository';

@Injectable()
export class BuyersService {
  constructor(private readonly repo: BuyersRepository) {}

  async list(query: PaginationQuery) {
    const { skip, take } = paginate(query.page, query.limit);
    const { rows, total } = await this.repo.findMany(skip, take);
    return Paginated.of(rows, query.page, query.limit, total);
  }

  /**
   * Tenant filtresi Prisma katmaninda otomatik. Ek olarak BUYER_USER yalniz KENDI carisini gorur
   * (ayni satici icinde bile yatay yetki asimi olmasin — §11.2 IDOR).
   */
  async findOne(id: string, user: RequestUser) {
    if (user.role === UserRole.BUYER_USER && user.buyerAccountId !== id) {
      throw new AppError(ErrorCode.TENANT_FORBIDDEN);
    }
    const account = await this.repo.findById(id);
    if (!account) throw new AppError(ErrorCode.NOT_FOUND);
    return account;
  }
}
