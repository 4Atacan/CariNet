import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import {
  AppError,
  ErrorCode,
  UserRole,
  type AcceptInviteInput,
  type AuthenticatedUser,
  type JwtPayload,
  type LoginInput,
  type LoginResponse,
  type MembershipSummary,
} from '@carinet/shared';
import { type Env } from '../../config/env';
import { MailService } from '../mail/mail.service';
import { AuthRepository } from './auth.repository';
import { PasswordService } from './password.service';
import { TokenService, type ClientMeta } from './token.service';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** 2FA zorunlu roller (kural #11) — prod'da bu roller 2FA'siz calisamaz. */
const TWO_FA_ROLES: readonly UserRole[] = [UserRole.SELLER_ADMIN, UserRole.PLATFORM_ADMIN];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly repo: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ---------------------------------------------------------------- giris

  async login(input: LoginInput, meta: ClientMeta): Promise<LoginResponse> {
    const user = await this.repo.findUserByEmail(input.email);

    // §11.1: tek tip yanit — kullanici var/yok sizdirilmaz.
    if (!user) {
      await this.passwords.verify(DUMMY_HASH, input.password); // zamanlama farkini kapat
      throw new AppError(ErrorCode.INVALID_CREDENTIALS);
    }
    if (!(await this.passwords.verify(user.passwordHash, input.password))) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS);
    }
    if (!user.isActive) throw new AppError(ErrorCode.ACCOUNT_INACTIVE);

    const memberships = await this.listMemberships(user.id);
    const active = this.pickMembership(memberships, input.sellerCode, user.isPlatformAdmin);

    this.assertTwoFactor(active?.role ?? UserRole.BUYER_USER, user.totpSecret, input.totp);

    const payload = this.toPayload(user.id, active, user.isPlatformAdmin);
    const tokens = await this.tokens.issue(payload, meta);

    if (active?.kind === 'BUYER') {
      await this.repo.touchAccountMembership(active.membershipId);
    }

    return { tokens, user: this.toAuthUser(user, payload), memberships };
  }

  /** §6.2 — hesap degistirici: yeni access+refresh cifti (yeni aile). */
  async switchAccount(userId: string, membershipId: string, meta: ClientMeta) {
    const user = await this.repo.findUserById(userId);
    if (!user || !user.isActive) throw new AppError(ErrorCode.ACCOUNT_INACTIVE);

    const memberships = await this.listMemberships(userId);
    const target = memberships.find((m) => m.membershipId === membershipId);
    if (!target) throw new AppError(ErrorCode.MEMBERSHIP_NOT_FOUND);

    this.assertTwoFactorOnSwitch(target.role, user.totpSecret);

    const payload = this.toPayload(userId, target, user.isPlatformAdmin);
    const tokens = await this.tokens.reissueForContext(payload, meta);

    if (target.kind === 'BUYER') {
      await this.repo.touchAccountMembership(target.membershipId);
    }

    return { tokens, user: this.toAuthUser(user, payload), memberships };
  }

  /** Refresh rotasyonu — baglami DB'den yeniden kurar (uyelik kaldirilmissa token olmez). */
  refresh(refreshToken: string, meta: ClientMeta) {
    return this.tokens.rotate(
      refreshToken,
      async (userId, membershipCtx) => {
        const user = await this.repo.findUserById(userId);
        if (!user || !user.isActive) throw new AppError(ErrorCode.ACCOUNT_INACTIVE);

        const memberships = await this.listMemberships(userId);
        const active = membershipCtx
          ? memberships.find((m) => m.membershipId === membershipCtx)
          : undefined;

        if (membershipCtx && !active) {
          // Uyelik kaldirilmis → bu baglamin ailesi gecersiz (§6.2).
          throw new AppError(ErrorCode.MEMBERSHIP_NOT_FOUND);
        }
        return this.toPayload(userId, active, user.isPlatformAdmin);
      },
      meta,
    );
  }

  async logout(refreshToken?: string): Promise<{ ok: true }> {
    if (refreshToken) await this.tokens.revoke(refreshToken);
    return { ok: true };
  }

  async logoutAll(userId: string): Promise<{ ok: true }> {
    await this.tokens.revokeAll(userId);
    return { ok: true };
  }

  sessions(userId: string) {
    return this.repo.listSessions(userId);
  }

  async me(userId: string): Promise<AuthenticatedUser & { memberships: MembershipSummary[] }> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND);
    const memberships = await this.listMemberships(userId);
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: UserRole.BUYER_USER,
      sellerId: null,
      buyerAccountId: null,
      membershipId: null,
      memberships,
    };
  }

  // ---------------------------------------------------------------- uyelikler (§6.2)

  async listMemberships(userId: string): Promise<MembershipSummary[]> {
    const [sellerMembers, accountMembers] = await Promise.all([
      this.repo.findSellerMemberships(userId),
      this.repo.findAccountMemberships(userId),
    ]);

    const seller: MembershipSummary[] = sellerMembers.map((m) => ({
      membershipId: m.id,
      kind: 'SELLER',
      role: m.role === 'ADMIN' ? UserRole.SELLER_ADMIN : UserRole.SELLER_STAFF,
      sellerId: m.sellerId,
      sellerName: m.seller.name,
      sellerSlug: m.seller.slug,
    }));

    const buyer: MembershipSummary[] = accountMembers.map((m) => ({
      membershipId: m.id,
      kind: 'BUYER',
      role: UserRole.BUYER_USER,
      sellerId: m.buyerAccount.sellerId,
      sellerName: m.buyerAccount.seller.name,
      sellerSlug: m.buyerAccount.seller.slug,
      buyerAccountId: m.buyerAccountId,
      accountCode: m.buyerAccount.accountCode,
      accountTitle: m.buyerAccount.title,
      lastActiveAt: m.lastActiveAt?.toISOString(),
    }));

    return [...seller, ...buyer];
  }

  // ---------------------------------------------------------------- sifre sifirlama

  /** §11.1: yanit her zaman ayni — e-posta kayitli mi sizdirilmaz. */
  async forgotPassword(email: string): Promise<{ ok: true }> {
    const user = await this.repo.findUserByEmail(email);
    if (user?.isActive) {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 saat
      await this.repo.createPasswordResetToken(user.id, sha256(token), expiresAt);
      const url = `${this.config.get('PANEL_ORIGIN', { infer: true })}/sifre-sifirla?token=${token}`;
      await this.mail.sendPasswordReset(email, user.fullName, url);
    }
    return { ok: true };
  }

  async resetPassword(token: string, password: string): Promise<{ ok: true }> {
    const record = await this.repo.findPasswordResetToken(sha256(token));
    if (!record || record.usedAt) throw new AppError(ErrorCode.INVITE_INVALID);
    if (record.expiresAt.getTime() < Date.now()) throw new AppError(ErrorCode.INVITE_EXPIRED);

    const passwordHash = await this.passwords.hash(password);
    await this.repo.updatePassword(record.userId, passwordHash);
    await this.repo.consumePasswordResetToken(record.id);
    // Sifre degisti → tum oturumlar kapanir (§11.1).
    await this.tokens.revokeAll(record.userId);
    return { ok: true };
  }

  // ---------------------------------------------------------------- davet iskeleti (§6.2)

  /** Satici paneli cari icin davet uretir → /j/{sellerSlug}/{token} */
  async createInvite(
    sellerId: string,
    buyerAccountId: string,
    expiresInHours: number,
    actorUserId: string,
  ) {
    const [account, seller] = await Promise.all([
      this.repo.findBuyerAccount(sellerId, buyerAccountId),
      this.repo.findSellerById(sellerId),
    ]);
    if (!account || !seller) throw new AppError(ErrorCode.NOT_FOUND);

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    await this.repo.createInvite({
      sellerId,
      buyerAccountId,
      tokenHash: sha256(token),
      expiresAt,
      createdById: actorUserId,
    });

    return { url: `/j/${seller.slug}/${token}`, token, expiresAt: expiresAt.toISOString() };
  }

  async acceptInvite(input: AcceptInviteInput, meta: ClientMeta): Promise<LoginResponse> {
    const invite = await this.repo.findInviteByHash(sha256(input.token));
    if (!invite || invite.seller.slug !== input.sellerSlug || invite.usedAt) {
      throw new AppError(ErrorCode.INVITE_INVALID);
    }
    if (invite.expiresAt.getTime() < Date.now()) throw new AppError(ErrorCode.INVITE_EXPIRED);

    // Kuresel kimlik: e-posta zaten kayitliysa YENI kullanici acilmaz, uyelik eklenir (§6.2).
    const existing = await this.repo.findUserByEmail(input.email);
    if (existing && !(await this.passwords.verify(existing.passwordHash, input.password))) {
      throw new AppError(
        ErrorCode.INVALID_CREDENTIALS,
        'Bu e-posta zaten kayitli. Mevcut sifrenizle devam edin.',
      );
    }

    const passwordHash = existing
      ? existing.passwordHash
      : await this.passwords.hash(input.password);

    const { user } = await this.repo.acceptInvite({
      inviteId: invite.id,
      buyerAccountId: invite.buyerAccountId,
      user: {
        id: existing?.id,
        email: input.email,
        phone: input.phone,
        fullName: input.fullName,
        passwordHash,
      },
    });

    const memberships = await this.listMemberships(user.id);
    const active = memberships.find((m) => m.buyerAccountId === invite.buyerAccountId);
    const payload = this.toPayload(user.id, active, user.isPlatformAdmin);
    const tokens = await this.tokens.issue(payload, meta);

    return { tokens, user: this.toAuthUser(user, payload), memberships };
  }

  // ---------------------------------------------------------------- ic yardimcilar

  private pickMembership(
    memberships: MembershipSummary[],
    sellerCode: string | undefined,
    isPlatformAdmin: boolean,
  ): MembershipSummary | undefined {
    if (memberships.length === 0) {
      if (isPlatformAdmin) return undefined;
      throw new AppError(ErrorCode.MEMBERSHIP_NOT_FOUND);
    }
    if (sellerCode) {
      const match = memberships.find(
        (m) => m.sellerSlug === sellerCode || m.accountCode === sellerCode,
      );
      if (!match) throw new AppError(ErrorCode.MEMBERSHIP_NOT_FOUND);
      return match;
    }
    // Varsayilan: satici personeligi > en son aktif cari.
    return memberships.find((m) => m.kind === 'SELLER') ?? memberships[0];
  }

  private toPayload(
    userId: string,
    membership: MembershipSummary | undefined,
    isPlatformAdmin: boolean,
  ): JwtPayload {
    if (!membership) {
      if (!isPlatformAdmin) throw new AppError(ErrorCode.MEMBERSHIP_NOT_FOUND);
      return {
        sub: userId,
        mem: null,
        role: UserRole.PLATFORM_ADMIN,
        sellerId: null,
        buyerAccountId: null,
      };
    }
    return {
      sub: userId,
      mem: membership.membershipId,
      role: membership.role,
      sellerId: membership.sellerId,
      buyerAccountId: membership.buyerAccountId ?? null,
    };
  }

  private toAuthUser(
    user: { id: string; email: string | null; phone: string | null; fullName: string },
    payload: JwtPayload,
  ): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: payload.role,
      sellerId: payload.sellerId,
      buyerAccountId: payload.buyerAccountId,
      membershipId: payload.mem,
    };
  }

  /** Kural #11 — prod'da SELLER_ADMIN / PLATFORM_ADMIN 2FA'siz giremez. */
  private assertTwoFactor(role: UserRole, totpSecret: string | null, code?: string): void {
    if (totpSecret) {
      if (!code) throw new AppError(ErrorCode.TOTP_REQUIRED);
      if (!authenticator.verify({ token: code, secret: totpSecret })) {
        throw new AppError(ErrorCode.TOTP_INVALID);
      }
      return;
    }
    this.assertTwoFactorOnSwitch(role, totpSecret);
  }

  private assertTwoFactorOnSwitch(role: UserRole, totpSecret: string | null): void {
    const isProd = this.config.get('NODE_ENV', { infer: true }) === 'production';
    if (isProd && TWO_FA_ROLES.includes(role) && !totpSecret) {
      throw new AppError(
        ErrorCode.TOTP_REQUIRED,
        'Bu rol icin iki adimli dogrulama zorunludur. Lutfen 2FA kurulumunu tamamlayin.',
      );
    }
  }
}

/** Kullanici bulunamadiginda da argon2 dogrulamasi calissin diye sabit hash (timing attack). */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$Yn5H1uYyQnZKrEXlYVJfBOgxYIYWKzZ1PBcTKO2Y7wo';
