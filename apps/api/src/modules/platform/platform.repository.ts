import { Inject, Injectable } from '@nestjs/common';
import { PRISMA, type PrismaService } from '../../prisma/prisma.module';
import { TenantContext } from '../../common/tenant/tenant-context';

/**
 * Platform yonetimi — TEK yer ki tenant filtresi bilerek atlanir.
 *
 * Kural #3 tenant izolasyonunu mutlak kilar; buradaki sorgular `runAsSystem` ile calisir
 * cunku platform admini tanimi geregi hicbir tenant'a ait DEGILDIR (uyeligi yoktur).
 * Bu yuzden her metot yalnizca SATICI KOKU seviyesinde is gorur: satici listesi ve olusturma.
 * Tenant ICI veri (cari, hareket, fatura) buradan ASLA okunmaz — o kapi acilirsa izolasyon
 * tek bir rolun arkasinda erir. Tenant verisi gerekiyorsa satici baglamiyla girilmeli.
 */
@Injectable()
export class PlatformRepository {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  listSellers() {
    return TenantContext.runAsSystem(() =>
      this.prisma.seller.findMany({
        orderBy: { sellerNo: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          sellerNo: true,
          isActive: true,
          createdAt: true,
          _count: { select: { members: true, buyerAccounts: true } },
        },
      }),
    );
  }

  findSellerBySlug(slug: string) {
    return TenantContext.runAsSystem(() => this.prisma.seller.findUnique({ where: { slug } }));
  }

  createSeller(data: { name: string; slug: string }) {
    return TenantContext.runAsSystem(() => this.prisma.seller.create({ data }));
  }

  setSellerActive(id: string, isActive: boolean) {
    return TenantContext.runAsSystem(() =>
      this.prisma.seller.update({ where: { id }, data: { isActive } }),
    );
  }

  /** Bir saticinin bekleyen (kullanilmamis, suresi gecmemis) yonetici davetleri. */
  listOpenInvites(sellerId: string) {
    return TenantContext.runAsSystem(() =>
      this.prisma.invite.findMany({
        where: { sellerId, role: { not: null }, usedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, role: true, expiresAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }
}
