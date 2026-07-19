import { Injectable } from '@nestjs/common';
import { AppError, ErrorCode } from '@carinet/shared';
import { AuditService } from '../../common/audit/audit.service';
import { PlatformRepository } from './platform.repository';

@Injectable()
export class PlatformService {
  constructor(
    private readonly repo: PlatformRepository,
    private readonly audit: AuditService,
  ) {}

  async listSellers() {
    const sellers = await this.repo.listSellers();
    return sellers.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      sellerNo: s.sellerNo,
      isActive: s.isActive,
      createdAt: s.createdAt.toISOString(),
      memberCount: s._count.members,
      buyerCount: s._count.buyerAccounts,
    }));
  }

  async createSeller(input: { name: string; slug: string }, actorUserId: string) {
    // Slug misafir odeme adresinde gorunur (§8: pay/{sellerSlug}) → catisma sessiz kalmamali.
    if (await this.repo.findSellerBySlug(input.slug)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Bu kisa ad (slug) zaten kullaniliyor.');
    }
    const seller = await this.repo.createSeller(input);
    await this.audit.log({
      actorUserId,
      action: 'SELLER_CREATED',
      entity: 'Seller',
      entityId: seller.id,
      after: { name: seller.name, slug: seller.slug },
    });
    return { id: seller.id, name: seller.name, slug: seller.slug, sellerNo: seller.sellerNo };
  }

  async setSellerActive(sellerId: string, isActive: boolean, actorUserId: string) {
    const seller = await this.repo.setSellerActive(sellerId, isActive);
    // §6.2 — satici pasifleserse alicilar salt-okunur gorur; izlenebilir olmali.
    await this.audit.log({
      actorUserId,
      action: isActive ? 'SELLER_ACTIVATED' : 'SELLER_DEACTIVATED',
      entity: 'Seller',
      entityId: sellerId,
    });
    return { id: seller.id, isActive: seller.isActive };
  }

  listOpenInvites(sellerId: string) {
    return this.repo.listOpenInvites(sellerId);
  }
}
