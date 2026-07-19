import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type SellerMemberRole } from '@prisma/client';
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
  type TwoFactorEnableResponse,
  type TwoFactorSetupResponse,
} from '@carinet/shared';
import { type Env } from '../../config/env';
import { AuditService } from '../../common/audit/audit.service';
import { MailService } from '../mail/mail.service';
import { AuthRepository } from './auth.repository';
import { BreachedPasswordService } from './breached-password.service';
import { PasswordService } from './password.service';
import { TokenService, type ClientMeta } from './token.service';
import { TwoFactorService, hashBackupCode } from './two-factor.service';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** 2FA zorunlu roller (kural #11) — prod'da bu roller 2FA'siz calisamaz. */
const TWO_FA_ROLES: readonly UserRole[] = [UserRole.SELLER_ADMIN, UserRole.PLATFORM_ADMIN];

type UserRecord = { id: string; totpSecret: string | null; backupCodes: string[] };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly repo: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly twoFactor: TwoFactorService,
    private readonly breached: BreachedPasswordService,
    private readonly audit: AuditService,
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

    await this.verifySecondFactor(user, active?.role ?? UserRole.BUYER_USER, input);

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

    this.assertTwoFactorRequired(target.role, user.totpSecret);

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

    // §11.1 — yeni sifre sizmis parola listesinde olmamali (fail-open).
    await this.breached.assertNotBreached(password);

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

  /**
   * Satici personeli daveti (§6.2). Alici davetinden ayri bir uctur cunku hedefi cari degil,
   * SATICININ KENDISI; kabul akisi da 2FA kurulumunu icerir (kural #11).
   */
  async createSellerInvite(
    sellerId: string,
    role: SellerMemberRole,
    expiresInHours: number,
    actorUserId: string,
  ) {
    const seller = await this.repo.findSellerById(sellerId);
    if (!seller) throw new AppError(ErrorCode.NOT_FOUND);

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    await this.repo.createInvite({
      sellerId,
      role,
      tokenHash: sha256(token),
      expiresAt,
      createdById: actorUserId,
    });
    await this.audit.log({
      action: 'SELLER_INVITE_CREATED',
      entity: 'Seller',
      entityId: sellerId,
      after: { role },
    });

    return { url: `/davet/${token}`, token, expiresAt: expiresAt.toISOString() };
  }

  /** Davet gecerli mi + satici tarafi mi — iki adimda da ayni kontrol. */
  private async requireSellerInvite(token: string) {
    const invite = await this.repo.findInviteByHash(sha256(token));
    if (!invite || !invite.role || invite.usedAt) throw new AppError(ErrorCode.INVITE_INVALID);
    if (invite.expiresAt.getTime() < Date.now()) throw new AppError(ErrorCode.INVITE_EXPIRED);
    return invite;
  }

  /**
   * Satici daveti — 1. ADIM: parola belirlenir, aday TOTP anahtari uretilip DAVET SATIRINDA
   * bekletilir. Kullanici kaydi HENUZ acilmaz: kod dogrulanmadan hesap olusursa 2FA'siz bir
   * SELLER_ADMIN ortaya cikardi ve kural #11 ihlal edilirdi.
   */
  async startSellerInvite(token: string, password: string) {
    const invite = await this.requireSellerInvite(token);
    // §11.1 — sizmis parola kontrolu (fail-open; servis erisilemezse akis durmaz).
    await this.breached.assertNotBreached(password);

    const setup = this.twoFactor.generateSecret(`${invite.seller.slug}`);
    await this.repo.setInvitePendingTotp(invite.id, setup.secret);

    return {
      sellerName: invite.seller.name,
      role: invite.role,
      otpauthUrl: setup.otpauthUrl,
      secret: setup.secret,
    };
  }

  /**
   * Satici daveti — 2. ADIM: kod dogrulanir ve hesap TEK transaction'da acilir.
   * Parola burada TEKRAR alinir: 1. adimla ayni oturum olmayabilir (kullanici sekmeyi
   * yenileyebilir), ve hash yalnizca bu noktada yazilir.
   */
  async completeSellerInvite(
    token: string,
    input: { email: string; fullName: string; password: string; totp: string },
    meta: ClientMeta,
  ): Promise<LoginResponse> {
    const invite = await this.requireSellerInvite(token);
    if (!invite.totpPendingSecret) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Once 2FA kurulumunu baslatin.');
    }
    if (!this.twoFactor.verify(input.totp, invite.totpPendingSecret)) {
      throw new AppError(ErrorCode.TOTP_INVALID);
    }

    // Kuresel kimlik (§6.2): e-posta kayitliysa yeni kullanici acilmaz, parolasi dogrulanir.
    const existing = await this.repo.findUserByEmail(input.email);
    if (existing && !(await this.passwords.verify(existing.passwordHash, input.password))) {
      throw new AppError(
        ErrorCode.INVALID_CREDENTIALS,
        'Bu e-posta zaten kayitli. Mevcut sifrenizle devam edin.',
      );
    }
    if (!existing) await this.breached.assertNotBreached(input.password);

    const codes = this.twoFactor.generateBackupCodes();
    const { user } = await this.repo.acceptSellerInvite({
      inviteId: invite.id,
      sellerId: invite.sellerId,
      role: invite.role!,
      totpSecret: invite.totpPendingSecret,
      backupCodes: codes.hashes,
      user: {
        id: existing?.id,
        email: input.email,
        fullName: input.fullName,
        passwordHash: existing ? existing.passwordHash : await this.passwords.hash(input.password),
      },
    });

    await this.audit.log({
      action: 'SELLER_INVITE_ACCEPTED',
      entity: 'User',
      entityId: user.id,
      after: { sellerId: invite.sellerId, role: invite.role },
    });

    const memberships = await this.listMemberships(user.id);
    const active = memberships.find((m) => m.sellerId === invite.sellerId);
    const payload = this.toPayload(user.id, active, user.isPlatformAdmin);
    const tokens = await this.tokens.issue(payload, meta);

    // Yedek kodlar YALNIZ burada, bir kez donulur — sonrasinda yalniz hash'leri saklanir.
    return { tokens, user: this.toAuthUser(user, payload), memberships, backupCodes: codes.plain };
  }

  async acceptInvite(input: AcceptInviteInput, meta: ClientMeta): Promise<LoginResponse> {
    const invite = await this.repo.findInviteByHash(sha256(input.token));
    // buyerAccountId artik nullable (ayni tablo satici davetini de tasiyor) → bu uc YALNIZ
    // alici davetini kabul eder; satici daveti /auth/seller-invite/* uzerinden ilerler.
    if (
      !invite ||
      !invite.buyerAccountId ||
      invite.seller.slug !== input.sellerSlug ||
      invite.usedAt
    ) {
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

    // §11.1 — YENI kullanici icin sizmis parola kontrolu (mevcut kullanici zaten sifresiyle giriyor).
    if (!existing) await this.breached.assertNotBreached(input.password);

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

  // ---------------------------------------------------------------- 2FA kurulumu (§11.1)

  /** Kurulumu baslat: parola dogrulanir, aday secret + QR URL doner (henuz aktif DEGIL). */
  async startTwoFactorSetup(userId: string, password: string): Promise<TwoFactorSetupResponse> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND);
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS);
    }
    const setup = this.twoFactor.generateSecret(user.email ?? user.phone ?? user.fullName);
    await this.repo.setPendingTotp(userId, setup.secret);
    return setup;
  }

  /**
   * Oturum acikken parola degistirme (§11.1). Mevcut parola sorulur: calinmis bir oturum
   * tek basina parolayi degistirip hesabi ele geciremesin.
   * Basarinca TUM refresh aileleri iptal edilir — eski oturumlar dusmeli (§6.3).
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND);
    if (!(await this.passwords.verify(user.passwordHash, currentPassword))) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS);
    }
    await this.breached.assertNotBreached(newPassword);

    await this.repo.updatePassword(user.id, await this.passwords.hash(newPassword));
    await this.tokens.revokeAll(user.id);
    await this.audit.log({ action: 'PASSWORD_CHANGED', entity: 'User', entityId: user.id });
    return { ok: true as const };
  }

  /** Kurulumu tamamla: aday secret'i koddan dogrula, aktifle, tek seferlik yedek kodlari doner. */
  async enableTwoFactor(userId: string, code: string): Promise<TwoFactorEnableResponse> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND);
    if (!user.totpPendingSecret) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Once 2FA kurulumunu baslatin.');
    }
    if (!this.twoFactor.verify(code, user.totpPendingSecret)) {
      throw new AppError(ErrorCode.TOTP_INVALID);
    }
    const codes = this.twoFactor.generateBackupCodes();
    await this.repo.enableTotp(userId, user.totpPendingSecret, codes.hashes);
    await this.audit.log({ action: '2FA_ENABLED', entity: 'User', entityId: userId });
    return { backupCodes: codes.plain };
  }

  /** 2FA'yi kapat — parola VE gecerli kod ister (calinmis oturum tek basina kapatamasin). */
  async disableTwoFactor(userId: string, password: string, code: string): Promise<{ ok: true }> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND);
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS);
    }
    if (!user.totpSecret || !this.twoFactor.verify(code, user.totpSecret)) {
      throw new AppError(ErrorCode.TOTP_INVALID);
    }
    await this.repo.disableTotp(userId);
    await this.audit.log({ action: '2FA_DISABLED', entity: 'User', entityId: userId });
    return { ok: true };
  }

  // ---------------------------------------------------------------- hesap silme (§6.2 / §11.6 KVKK)

  /**
   * Hesabi sil: parola dogrulanir, kimlik ANONIMLESTIRILIR (finansal kayitlar satici defterinde kalir),
   * uyelikler + push tokenlari kaldirilir, tum oturumlar iptal edilir. Geri alinamaz.
   */
  async deleteAccount(userId: string, password: string): Promise<{ ok: true }> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND);
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS);
    }
    await this.repo.removeMemberships(userId);
    await this.repo.anonymizeUser(userId, `Silinmis Kullanici ${randomBytes(4).toString('hex')}`);
    await this.tokens.revokeAll(userId);
    await this.audit.log({ action: 'ACCOUNT_DELETED', entity: 'User', entityId: userId });
    this.logger.log(`Hesap silindi (anonimlestirildi): user=${userId}`);
    return { ok: true };
  }

  // ---------------------------------------------------------------- 2FA dogrulama (giris/switch)

  /** Girişte ikinci faktor: TOTP kodu VEYA yedek kurtarma kodu. Secret yoksa prod zorunlulugunu uygular. */
  private async verifySecondFactor(
    user: UserRecord & { totpSecret: string | null },
    role: UserRole,
    input: LoginInput,
  ): Promise<void> {
    if (user.totpSecret) {
      if (input.totp && this.twoFactor.verify(input.totp, user.totpSecret)) return;
      if (input.recoveryCode && (await this.tryConsumeBackupCode(user, input.recoveryCode))) return;
      if (!input.totp && !input.recoveryCode) throw new AppError(ErrorCode.TOTP_REQUIRED);
      throw new AppError(ErrorCode.TOTP_INVALID);
    }
    this.assertTwoFactorRequired(role, user.totpSecret);
  }

  /** Yedek kod eslesirse tuketir (tek kullanimlik) ve true doner. */
  private async tryConsumeBackupCode(user: UserRecord, code: string): Promise<boolean> {
    const hash = hashBackupCode(code);
    if (!user.backupCodes.includes(hash)) return false;
    await this.repo.setBackupCodes(
      user.id,
      user.backupCodes.filter((h) => h !== hash),
    );
    await this.audit.log({ action: '2FA_BACKUP_CODE_USED', entity: 'User', entityId: user.id });
    return true;
  }

  /** Kural #11 — prod'da SELLER_ADMIN / PLATFORM_ADMIN 2FA'siz calisamaz (secret yoksa engelle). */
  private assertTwoFactorRequired(role: UserRole, totpSecret: string | null): void {
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
