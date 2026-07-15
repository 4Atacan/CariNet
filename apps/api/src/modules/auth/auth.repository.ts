import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { PRISMA, type PrismaService } from '../../prisma/prisma.module';
import { TenantContext } from '../../common/tenant/tenant-context';

/**
 * Auth, tenant baglami OLUSMADAN once calisir (login/refresh/davet kabulu).
 * Bu yuzden tenant modellerine (SellerMember, BuyerAccount, Invite) erisirken bilincli olarak
 * sistem modunu kullanir — tek istisna noktasi burasidir ve kapsami bu dosyayla sinirlidir.
 */
@Injectable()
export class AuthRepository {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  private system<T>(fn: () => Promise<T>): Promise<T> {
    return TenantContext.runAsSystem(fn);
  }

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findUserByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  /** Satici personeli uyelikleri (§6.2) */
  findSellerMemberships(userId: string) {
    return this.system(() =>
      this.prisma.sellerMember.findMany({
        where: { userId },
        include: { seller: true },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  /** Alici (cari) uyelikleri — ayni kullanici birden cok saticida cari olabilir (§6.2) */
  findAccountMemberships(userId: string) {
    return this.system(() =>
      this.prisma.accountMembership.findMany({
        where: { userId },
        include: { buyerAccount: { include: { seller: true } } },
        orderBy: [{ lastActiveAt: 'desc' }, { createdAt: 'asc' }],
      }),
    );
  }

  findSellerMemberById(id: string) {
    return this.system(() =>
      this.prisma.sellerMember.findFirst({ where: { id }, include: { seller: true } }),
    );
  }

  findAccountMembershipById(id: string) {
    return this.system(() =>
      this.prisma.accountMembership.findFirst({
        where: { id },
        include: { buyerAccount: { include: { seller: true } } },
      }),
    );
  }

  touchAccountMembership(id: string) {
    return this.system(() =>
      this.prisma.accountMembership.update({ where: { id }, data: { lastActiveAt: new Date() } }),
    );
  }

  // ---------------------------------------------------------------- refresh token (§6.3)

  createRefreshToken(data: Prisma.RefreshTokenUncheckedCreateInput) {
    return this.prisma.refreshToken.create({ data });
  }

  findRefreshTokenByHash(tokenHash: string) {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  revokeRefreshToken(id: string, replacedById?: string) {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedById },
    });
  }

  /** Reuse tespiti → ailenin TAMAMI iptal (§6.3). */
  revokeFamily(familyId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllForUser(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Uyelik kaldirilinca o baglamin ailesi iptal edilir (§6.2). */
  revokeByMembershipContext(userId: string, membershipCtx: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, membershipCtx, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  listSessions(userId: string) {
    return this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        familyId: true,
        membershipCtx: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        expiresAt: true,
      },
    });
  }

  // ---------------------------------------------------------------- sifre sifirlama

  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
  }

  findPasswordResetToken(tokenHash: string) {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  consumePasswordResetToken(id: string) {
    return this.prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  updatePassword(userId: string, passwordHash: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  // ---------------------------------------------------------------- 2FA kurulumu (§11.1)

  /** Aday secret'i beklemeye alir (enable'da dogrulanip totpSecret'e tasinir). */
  setPendingTotp(userId: string, pendingSecret: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { totpPendingSecret: pendingSecret },
    });
  }

  /** Kurulum tamamlandi: aday secret aktif olur, yedek kodlarin hash'i saklanir. */
  enableTotp(userId: string, secret: string, backupCodeHashes: string[]) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: secret,
        totpPendingSecret: null,
        totpEnabledAt: new Date(),
        backupCodes: backupCodeHashes,
      },
    });
  }

  disableTotp(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: null,
        totpPendingSecret: null,
        totpEnabledAt: null,
        backupCodes: [],
      },
    });
  }

  /** Yedek kod kullanilinca kalan hash listesi yazilir (tek kullanimlik). */
  setBackupCodes(userId: string, hashes: string[]) {
    return this.prisma.user.update({ where: { id: userId }, data: { backupCodes: hashes } });
  }

  // ---------------------------------------------------------------- hesap silme (§6.2 / §11.6)

  /** Kimlik anonimlestirilir; finansal kayitlar (transactions, audit) DEFTERDE KALIR (yasal saklama). */
  anonymizeUser(userId: string, anonymizedFullName: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        email: null,
        phone: null,
        fullName: anonymizedFullName,
        totpSecret: null,
        totpPendingSecret: null,
        totpEnabledAt: null,
        backupCodes: [],
        isActive: false,
        anonymizedAt: new Date(),
      },
    });
  }

  /** Silmeden once uyelikleri kaldirir (satici defterindeki finansal veri user_id'siz kalmaz — FK yok). */
  removeMemberships(userId: string) {
    return TenantContext.runAsSystem(async () => {
      await this.prisma.accountMembership.deleteMany({ where: { userId } });
      await this.prisma.sellerMember.deleteMany({ where: { userId } });
      await this.prisma.pushToken.deleteMany({ where: { userId } });
    });
  }

  // ---------------------------------------------------------------- davet (§6.2)

  createInvite(data: Prisma.InviteUncheckedCreateInput) {
    return this.prisma.invite.create({ data });
  }

  /** Misafir akisi: token hash'i ile davet + satici + cari. Tenant baglami henuz yok. */
  findInviteByHash(tokenHash: string) {
    return this.system(() =>
      this.prisma.invite.findFirst({
        where: { tokenHash },
        include: { seller: true, buyerAccount: true },
      }),
    );
  }

  /** Davet kabulu: kullanici (varsa) + uyelik + davet tuketimi tek transactionda. */
  acceptInvite(params: {
    inviteId: string;
    buyerAccountId: string;
    user: { id?: string; email: string; phone?: string; fullName: string; passwordHash: string };
  }) {
    return this.system(async () =>
      this.prisma.$transaction(async (tx) => {
        const user = params.user.id
          ? await tx.user.update({ where: { id: params.user.id }, data: {} })
          : await tx.user.create({
              data: {
                email: params.user.email,
                phone: params.user.phone,
                fullName: params.user.fullName,
                passwordHash: params.user.passwordHash,
              },
            });

        const membership = await tx.accountMembership.upsert({
          where: {
            userId_buyerAccountId: { userId: user.id, buyerAccountId: params.buyerAccountId },
          },
          create: { userId: user.id, buyerAccountId: params.buyerAccountId },
          update: { lastActiveAt: new Date() },
        });

        await tx.invite.update({ where: { id: params.inviteId }, data: { usedAt: new Date() } });

        return { user, membership };
      }),
    );
  }

  findBuyerAccount(sellerId: string, buyerAccountId: string) {
    return this.prisma.buyerAccount.findFirst({ where: { id: buyerAccountId, sellerId } });
  }

  /** Seller tenant modeli degil (tenant'in KOKU) — sistem moduna gerek yok. */
  findSellerById(sellerId: string) {
    return this.prisma.seller.findUnique({ where: { id: sellerId } });
  }
}
