import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PRISMA, type PrismaService } from '../../prisma/prisma.module';

/** SellerBankAccount / SellerPosConfig tenant modelidir → seller_id eklentiden gelir (kural #3). */
@Injectable()
export class SellersRepository {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- banka hesaplari

  listBankAccounts() {
    return this.prisma.sellerBankAccount.findMany({ orderBy: { createdAt: 'asc' } });
  }

  findBankAccount(id: string) {
    return this.prisma.sellerBankAccount.findFirst({ where: { id } });
  }

  createBankAccount(data: Omit<Prisma.SellerBankAccountUncheckedCreateInput, 'sellerId'>) {
    return this.prisma.sellerBankAccount.create({
      data: data as Prisma.SellerBankAccountUncheckedCreateInput,
    });
  }

  updateBankAccount(id: string, data: Prisma.SellerBankAccountUncheckedUpdateInput) {
    return this.prisma.sellerBankAccount.update({ where: { id }, data });
  }

  // ---------------------------------------------------------------- POS

  findPosConfig() {
    return this.prisma.sellerPosConfig.findFirst({ orderBy: { createdAt: 'desc' } });
  }

  createPosConfig(data: Omit<Prisma.SellerPosConfigUncheckedCreateInput, 'sellerId'>) {
    return this.prisma.sellerPosConfig.create({
      data: data as Prisma.SellerPosConfigUncheckedCreateInput,
    });
  }

  updatePosConfig(id: string, data: Prisma.SellerPosConfigUncheckedUpdateInput) {
    return this.prisma.sellerPosConfig.update({ where: { id }, data });
  }

  // ---------------------------------------------------------------- 2FA (kritik islem)

  /** User tenant modeli DEGIL → sistem modunda okunur; yalniz kendi kaydini sorar. */
  findUserSecret(userId: string) {
    return TenantContext.runAsSystem(() =>
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, totpSecret: true },
      }),
    );
  }

  seller(sellerId: string) {
    return TenantContext.runAsSystem(() =>
      this.prisma.seller.findUnique({
        where: { id: sellerId },
        select: { id: true, sellerNo: true, name: true, slug: true, logoUrl: true, isActive: true },
      }),
    );
  }
}
