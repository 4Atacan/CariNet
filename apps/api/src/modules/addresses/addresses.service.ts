import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorCode,
  UserRole,
  type CreateAddressInput,
  type UpdateAddressInput,
} from '@carinet/shared';
import { AuditService } from '../../common/audit/audit.service';
import { type RequestUser } from '../../common/types/request-with-user';
import { PRISMA, type PrismaService } from '../../prisma/prisma.module';

/**
 * Adres tenant modeli DEGILDIR (seller_id kolonu yok, cari uzerinden baglidir) →
 * tenant kontrolu BuyerAccount uzerinden ELLE yapilir; aksi halde IDOR acilir (§11.2).
 */
@Injectable()
export class AddressesService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(buyerAccountId: string, user: RequestUser) {
    await this.assertAccess(buyerAccountId, user);
    return this.prisma.address.findMany({ where: { buyerAccountId }, orderBy: { label: 'asc' } });
  }

  async create(input: CreateAddressInput, user: RequestUser) {
    await this.assertAccess(input.buyerAccountId, user);
    const address = await this.prisma.address.create({ data: input });
    await this.audit.log({
      action: 'CREATE',
      entity: 'Address',
      entityId: address.id,
      after: address,
    });
    return address;
  }

  async update(id: string, input: UpdateAddressInput, user: RequestUser) {
    const before = await this.requireAddress(id, user);
    const after = await this.prisma.address.update({ where: { id }, data: input });
    await this.audit.log({ action: 'UPDATE', entity: 'Address', entityId: id, before, after });
    return after;
  }

  /** Adres finansal kayit degil → hard delete serbest (kural #4). */
  async remove(id: string, user: RequestUser) {
    const before = await this.requireAddress(id, user);
    await this.prisma.address.delete({ where: { id } });
    await this.audit.log({ action: 'DELETE', entity: 'Address', entityId: id, before });
    return { id };
  }

  private async requireAddress(id: string, user: RequestUser) {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address) throw new AppError(ErrorCode.NOT_FOUND);
    await this.assertAccess(address.buyerAccountId, user);
    return address;
  }

  /** Cari BU tenant'a ait mi? (BuyerAccount tenant modeli → eklenti filtreler.) */
  private async assertAccess(buyerAccountId: string, user: RequestUser): Promise<void> {
    if (user.role === UserRole.BUYER_USER && user.buyerAccountId !== buyerAccountId) {
      throw new AppError(ErrorCode.TENANT_FORBIDDEN);
    }
    const account = await this.prisma.buyerAccount.findFirst({ where: { id: buyerAccountId } });
    if (!account) throw new AppError(ErrorCode.NOT_FOUND, 'Cari hesap bulunamadi');
  }
}
