import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  AppError,
  CollectChannel,
  ErrorCode,
  eq,
  toMoney,
  type MoneyString,
} from '@carinet/shared';
import { decryptSecret } from '../../../common/crypto/encryption';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { type Env } from '../../../config/env';
import { CollectionsRepository } from '../collections.repository';
import { IntentFactory } from '../intent-factory.service';
import { ReconciliationService } from '../reconciliation.service';
import { PosRegistry } from './pos/pos-registry.service';
import {
  type HostedPaymentStart,
  type InstallmentOption,
  type PosCredentials,
} from './pos/pos-adapter';
import {
  type CollectIntentInput,
  type CollectIntentView,
  type CollectionProvider,
  type CollectionResult,
  type ReconcileInput,
} from './collection-provider';

export interface CardPaymentStart extends HostedPaymentStart {
  intentId: string;
  referenceCode: string;
  /** Borctan dusulecek tutar. Karta cekilen tutar (vade farkli) BUNDAN farkli olabilir. */
  debtAmount: MoneyString;
  chargeAmount: MoneyString;
  installmentCount: number;
}

/**
 * §8 Kanal 2 — kart: SATICININ KENDI POS'u + saglayicinin hosted 3D sayfasi.
 *
 * Kritik ayrim (kural #1/#2): karta cekilen tutar ≠ cariden dusulen tutar.
 * Taksit vade farki BANKANIN gelirdir, saticiya gelmez → borc yalniz intent tutari kadar duser.
 * Callback'teki "chargedAmount" bu yuzden yalniz kanit/audit icindir, CREDIT'e yazilmaz.
 */
@Injectable()
export class CardPosProvider implements CollectionProvider {
  readonly channel = CollectChannel.CARD_POS;

  constructor(
    private readonly repo: CollectionsRepository,
    private readonly intents: IntentFactory,
    private readonly reconciliation: ReconciliationService,
    private readonly registry: PosRegistry,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async createIntent(input: CollectIntentInput): Promise<CollectIntentView> {
    await this.credentials(); // POS yoksa talep hic acilmasin
    const intent = await this.intents.createPending({
      sellerId: input.sellerId,
      buyerAccountId: input.buyerAccountId,
      amount: input.amount,
      channel: CollectChannel.CARD_POS,
      installmentCount: input.installmentCount ?? 1,
      createdByUserId: input.createdByUserId,
    });

    return {
      id: intent.id,
      referenceCode: intent.referenceCode,
      buyerAccountId: intent.buyerAccountId,
      amount: toMoney(intent.amount.toString()),
      currencyCode: intent.currencyCode.trim(),
      channel: CollectChannel.CARD_POS,
      status: 'PENDING',
      installmentCount: intent.installmentCount,
      expiresAt: intent.expiresAt,
      createdAt: intent.createdAt,
    };
  }

  /** Kanit: saglayicidan gelen IMZALI callback. Idempotent — ortak hat (§8). */
  reconcile(evidence: ReconcileInput): Promise<CollectionResult> {
    return this.reconciliation.apply(evidence, CollectChannel.CARD_POS);
  }

  /** Taksit secenekleri: tutar (+ istege bagli BIN) ile saglayicidan (§8). */
  async installments(amount: MoneyString, bin?: string): Promise<InstallmentOption[]> {
    const { adapter, credentials } = await this.credentials();
    return adapter.installments(amount, bin, credentials);
  }

  /**
   * Hosted 3D sayfasina yonlendirme paketi. Kart alanlari BIZDE degil, saglayicida (kural #5).
   */
  async startPayment(intentId: string): Promise<CardPaymentStart> {
    const intent = await this.repo.findIntent(intentId);
    if (!intent) throw new AppError(ErrorCode.NOT_FOUND, 'Odeme talebi bulunamadi');
    if (intent.status !== 'PENDING') throw new AppError(ErrorCode.INTENT_NOT_PENDING);
    if (intent.channel !== CollectChannel.CARD_POS) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Bu talep kart kanali icin acilmamis');
    }

    const { adapter, credentials } = await this.credentials();
    const debtAmount = toMoney(intent.amount.toString());
    const installmentCount = intent.installmentCount ?? 1;

    const option = adapter
      .installments(debtAmount, undefined, credentials)
      .find((o) => o.count === installmentCount);
    if (!option) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Secilen taksit sayisi desteklenmiyor');
    }

    const apiUrl = this.config.get('API_PUBLIC_URL', { infer: true });
    const panelUrl = this.config.get('PANEL_ORIGIN', { infer: true });
    const start = adapter.start(
      {
        referenceCode: intent.referenceCode,
        chargeAmount: option.totalAmount,
        installmentCount,
        callbackUrl: `${apiUrl}/v1/collections/pos-callback/${adapter.name}`,
        returnUrl: `${panelUrl}/odeme-sonucu?ref=${intent.referenceCode}`,
      },
      credentials,
    );

    return {
      ...start,
      intentId: intent.id,
      referenceCode: intent.referenceCode,
      debtAmount,
      chargeAmount: option.totalAmount,
      installmentCount,
    };
  }

  /**
   * §11.3 — imza dogrulanmadan HICBIR SEY islenmez. Basarisiz islemde talep PENDING kalir
   * (musteri tekrar deneyebilsin), yalniz audit yazilir.
   */
  async handleCallback(provider: string, body: unknown): Promise<CollectionResult | null> {
    const adapter = this.registry.get(provider);

    // Callback'te JWT yok. Once referans kodu (yalniz bir ARAMA ANAHTARI) okunur, satici bulunur
    // ve tenant baglami kurulur; imza o saticinin anahtariyla dogrulanana kadar HICBIR SEY yazilmaz.
    const orderId = readOrderId(body);
    const intent = await this.repo.findIntentByReference(orderId);
    if (!intent) throw new AppError(ErrorCode.NOT_FOUND, 'Odeme talebi bulunamadi');
    TenantContext.setSeller(intent.sellerId);

    const config = await this.repo.activePosConfig();
    if (!config) throw new AppError(ErrorCode.POS_NOT_CONFIGURED);
    if (config.provider.toUpperCase() !== adapter.name) {
      throw new AppError(ErrorCode.POS_SIGNATURE_INVALID, 'Saglayici eslesmiyor');
    }

    const result = adapter.verifyCallback(body, this.decrypt(config));
    if (result.referenceCode !== orderId) {
      throw new AppError(ErrorCode.POS_SIGNATURE_INVALID, 'Referans kodu tutarsiz');
    }
    if (!result.approved) return null;

    // Borc = intent tutari. Karta cekilen (vade farkli) tutar CREDIT'e yazilmaz.
    const debtAmount = toMoney(intent.amount.toString());
    const note = eq(result.chargedAmount, debtAmount)
      ? `Kart ile ${result.installmentCount} taksit`
      : `Kart ile ${result.installmentCount} taksit · karta cekilen ${result.chargedAmount} (vade farki bankaya ait)`;

    return this.reconcile({
      intentId: intent.id,
      amount: debtAmount,
      providerRef: result.providerRef,
      actorUserId: null,
      note,
    });
  }

  /** Saticinin AKTIF POS tanimi + cozulmus anahtarlar. Anahtarlar bellekte kalir, loglanmaz. */
  private async credentials(): Promise<{
    adapter: ReturnType<PosRegistry['get']>;
    credentials: PosCredentials;
  }> {
    const config = await this.repo.activePosConfig();
    if (!config) throw new AppError(ErrorCode.POS_NOT_CONFIGURED);
    return { adapter: this.registry.get(config.provider), credentials: this.decrypt(config) };
  }

  private decrypt(config: {
    provider: string;
    merchantId: string;
    apiKeyEnc: string;
    secretEnc: string;
  }): PosCredentials {
    const masterKey = this.config.get('MASTER_ENCRYPTION_KEY', { infer: true });
    if (!masterKey) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'MASTER_ENCRYPTION_KEY tanimli degil');
    }
    return {
      provider: config.provider,
      merchantId: config.merchantId,
      apiKey: decryptSecret(config.apiKeyEnc, masterKey),
      secret: decryptSecret(config.secretEnc, masterKey),
    };
  }
}

/** Imzadan ONCE okunan tek alan: hangi saticinin anahtariyla dogrulayacagimizi bulmak icin. */
const orderIdSchema = z.object({ orderId: z.string().min(1).max(100) });

function readOrderId(body: unknown): string {
  const parsed = orderIdSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(ErrorCode.POS_SIGNATURE_INVALID, 'Bildirim govdesi taninmadi');
  }
  return parsed.data.orderId;
}
