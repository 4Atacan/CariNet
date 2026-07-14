import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { AppError, ErrorCode, type BankAccountInput, type PosConfigInput } from '@carinet/shared';
import { AuditService } from '../../common/audit/audit.service';
import { decryptSecret, encryptSecret, maskSecret } from '../../common/crypto/encryption';
import { type RequestUser } from '../../common/types/request-with-user';
import { type Env } from '../../config/env';
import { PosRegistry } from '../collections/providers/pos/pos-registry.service';
import { SellersRepository } from './sellers.repository';

/**
 * §11.3 — IBAN degisikligi ve POS anahtari degisikligi KRITIK islemdir: 2FA + audit.
 * Sebep: IBAN'i degistirebilen biri tum tahsilati kendi hesabina yonlendirir; POS anahtarini
 * degistirebilen biri odemeleri baska bir uye isyerine tasir.
 */
@Injectable()
export class SellersService {
  private readonly logger = new Logger(SellersService.name);

  constructor(
    private readonly repo: SellersRepository,
    private readonly registry: PosRegistry,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async profile(user: RequestUser) {
    if (!user.sellerId) throw new AppError(ErrorCode.TENANT_FORBIDDEN);
    const seller = await this.repo.seller(user.sellerId);
    if (!seller) throw new AppError(ErrorCode.NOT_FOUND);
    return seller;
  }

  // ---------------------------------------------------------------- banka hesaplari

  listBankAccounts() {
    return this.repo.listBankAccounts();
  }

  async createBankAccount(input: BankAccountInput, user: RequestUser) {
    await this.assertTwoFactor(user, input.totp, 'IBAN ekleme');

    const account = await this.repo.createBankAccount({
      bankName: input.bankName,
      iban: input.iban,
      holderName: input.holderName,
      isActive: input.isActive,
    });

    await this.audit.log({
      action: 'BANK_ACCOUNT_CREATED',
      entity: 'SellerBankAccount',
      entityId: account.id,
      after: { bankName: account.bankName, iban: account.iban, holderName: account.holderName },
    });
    return account;
  }

  async updateBankAccount(id: string, input: BankAccountInput, user: RequestUser) {
    const before = await this.repo.findBankAccount(id);
    if (!before) throw new AppError(ErrorCode.NOT_FOUND);

    await this.assertTwoFactor(user, input.totp, 'IBAN degisikligi');

    const after = await this.repo.updateBankAccount(id, {
      bankName: input.bankName,
      iban: input.iban,
      holderName: input.holderName,
      isActive: input.isActive,
    });

    await this.audit.log({
      action: 'BANK_ACCOUNT_UPDATED',
      entity: 'SellerBankAccount',
      entityId: id,
      before: { iban: before.iban, holderName: before.holderName, isActive: before.isActive },
      after: { iban: after.iban, holderName: after.holderName, isActive: after.isActive },
    });
    return after;
  }

  /** Kritik: hesap kapatmak da tahsilati durdurur → 2FA + audit. Kayit SILINMEZ, pasiflenir. */
  async deactivateBankAccount(id: string, totp: string | undefined, user: RequestUser) {
    const before = await this.repo.findBankAccount(id);
    if (!before) throw new AppError(ErrorCode.NOT_FOUND);
    await this.assertTwoFactor(user, totp, 'IBAN pasiflestirme');

    const after = await this.repo.updateBankAccount(id, { isActive: false });
    await this.audit.log({
      action: 'BANK_ACCOUNT_DEACTIVATED',
      entity: 'SellerBankAccount',
      entityId: id,
      before: { isActive: true },
      after: { isActive: false },
    });
    return after;
  }

  // ---------------------------------------------------------------- POS (kural #5/#10)

  providers() {
    return this.registry.names();
  }

  /** Anahtarlar panelde MASKELI gorunur (§11.3) — tam degeri hicbir yanit tasimaz. */
  async posConfig() {
    const config = await this.repo.findPosConfig();
    if (!config) return null;

    const masterKey = this.masterKey();
    return {
      id: config.id,
      provider: config.provider,
      merchantId: config.merchantId,
      apiKeyMasked: maskSecret(decryptSecret(config.apiKeyEnc, masterKey)),
      secretMasked: maskSecret(decryptSecret(config.secretEnc, masterKey)),
      isActive: config.isActive,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * POS tanimi (upsert). Anahtarlar AES-256-GCM ile sifreli saklanir (kural #10);
   * duz metin ne DB'ye ne loga yazilir.
   */
  async savePosConfig(input: PosConfigInput, user: RequestUser) {
    this.registry.get(input.provider); // taninmayan saglayici kabul edilmez
    await this.assertTwoFactor(user, input.totp, 'POS anahtari degisikligi');

    const masterKey = this.masterKey();
    const data = {
      provider: input.provider.toUpperCase(),
      merchantId: input.merchantId,
      apiKeyEnc: encryptSecret(input.apiKey, masterKey),
      secretEnc: encryptSecret(input.secret, masterKey),
      isActive: input.isActive,
    };

    const existing = await this.repo.findPosConfig();
    const config = existing
      ? await this.repo.updatePosConfig(existing.id, data)
      : await this.repo.createPosConfig(data);

    // Audit'e ANAHTAR YAZILMAZ; yalniz "degisti" bilgisi.
    await this.audit.log({
      action: existing ? 'POS_CONFIG_UPDATED' : 'POS_CONFIG_CREATED',
      entity: 'SellerPosConfig',
      entityId: config.id,
      before: existing
        ? { provider: existing.provider, merchantId: existing.merchantId, keysChanged: true }
        : undefined,
      after: {
        provider: config.provider,
        merchantId: config.merchantId,
        isActive: config.isActive,
      },
    });

    return this.posConfig();
  }

  async deactivatePosConfig(totp: string | undefined, user: RequestUser) {
    const existing = await this.repo.findPosConfig();
    if (!existing) throw new AppError(ErrorCode.NOT_FOUND);
    await this.assertTwoFactor(user, totp, 'POS pasiflestirme');

    await this.repo.updatePosConfig(existing.id, { isActive: false });
    await this.audit.log({
      action: 'POS_CONFIG_DEACTIVATED',
      entity: 'SellerPosConfig',
      entityId: existing.id,
      before: { isActive: existing.isActive },
      after: { isActive: false },
    });
    return this.posConfig();
  }

  // ---------------------------------------------------------------- yardimcilar

  /**
   * Kural #11 — prod'da SELLER_ADMIN 2FA'siz calisamaz; kritik islem 2FA'siz YAPILAMAZ.
   * Gelistirmede (2FA kurulmamis kullanici) izin verilir ama uyari loglanir.
   */
  private async assertTwoFactor(
    user: RequestUser,
    code: string | undefined,
    action: string,
  ): Promise<void> {
    const record = await this.repo.findUserSecret(user.userId);
    if (record?.totpSecret) {
      if (!code) throw new AppError(ErrorCode.TOTP_REQUIRED);
      if (!authenticator.verify({ token: code, secret: record.totpSecret })) {
        throw new AppError(ErrorCode.TOTP_INVALID);
      }
      return;
    }

    if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      throw new AppError(
        ErrorCode.TOTP_REQUIRED,
        'Bu islem iki adimli dogrulama gerektirir. Lutfen 2FA kurulumunu tamamlayin.',
      );
    }
    this.logger.warn({ userId: user.userId, action }, 'Kritik islem 2FA olmadan yapildi (dev)');
  }

  private masterKey(): string {
    const key = this.config.get('MASTER_ENCRYPTION_KEY', { infer: true });
    if (!key) throw new AppError(ErrorCode.INTERNAL_ERROR, 'MASTER_ENCRYPTION_KEY tanimli degil');
    return key;
  }
}
