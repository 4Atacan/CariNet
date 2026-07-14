import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type CollectIntent } from '@prisma/client';
import {
  AppError,
  CollectChannel,
  ErrorCode,
  UserRole,
  paginate,
  toMoney,
  type CancelIntentInput,
  type CollectChannel as Channel,
  type ConfirmIntentInput,
  type CreateIntentInput,
  type GuestIntentInput,
  type InstallmentQuery,
  type IntentListQuery,
  type IntentStatus,
  type MoneyString,
} from '@carinet/shared';
import { AuditService } from '../../common/audit/audit.service';
import { Paginated } from '../../common/dto/paginated';
import { TenantContext } from '../../common/tenant/tenant-context';
import { type RequestUser } from '../../common/types/request-with-user';
import { type Env } from '../../config/env';
import { CollectionsRepository } from './collections.repository';
import { BankTransferProvider } from './providers/bank-transfer.provider';
import { CardPosProvider, type CardPaymentStart } from './providers/card-pos.provider';
import { type CollectionProvider } from './providers/collection-provider';

/** Misafir yolunda "cari var mi yok mu" sizdirmayan TEK mesaj (§8). */
const GUEST_GENERIC = 'Cari kodu veya tutar hatali. Lutfen bilgileri kontrol edin.';

@Injectable()
export class CollectionsService {
  private readonly logger = new Logger(CollectionsService.name);

  constructor(
    private readonly repo: CollectionsRepository,
    private readonly bankTransfer: BankTransferProvider,
    private readonly cardPos: CardPosProvider,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ---------------------------------------------------------------- talep acma

  /** Mobil "Odeme Yap" + panelden tahsilat baslatma. */
  async createIntent(input: CreateIntentInput, user: RequestUser) {
    if (!user.sellerId) throw new AppError(ErrorCode.TENANT_FORBIDDEN);

    // Alici yalniz KENDI carisi adina talep acabilir (§11.2 IDOR).
    const buyerAccountId =
      user.role === UserRole.BUYER_USER ? user.buyerAccountId : input.buyerAccountId;
    if (!buyerAccountId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Cari hesap secilmeli');
    }

    return this.open(
      {
        sellerId: user.sellerId,
        buyerAccountId,
        amount: input.amount,
        channel: input.channel,
        installmentCount: input.installmentCount,
        createdByUserId: user.userId,
      },
      input.channel,
    );
  }

  /**
   * Misafir odeme sayfasi `pay/{sellerSlug}` (§8): kimlik yok.
   * Yanit, cari kodunun VAR OLUP OLMADIGINI sizdirmaz — hatali kod ile hatali tutar ayni cevabi alir.
   */
  async guestIntent(sellerSlug: string, input: GuestIntentInput) {
    await this.assertTurnstile(input.turnstileToken);

    const seller = await this.repo.sellerBySlug(sellerSlug);
    if (!seller?.isActive) throw new AppError(ErrorCode.VALIDATION_ERROR, GUEST_GENERIC);
    TenantContext.setSeller(seller.id);

    const account = await this.repo.findAccountByCode(input.accountCode);
    if (!account?.isActive) {
      // Sabit gecikme yok ama sabit MESAJ var: var/yok ayrimi yapilmaz.
      this.logger.warn({ sellerSlug }, 'Misafir odeme: cari kodu bulunamadi');
      throw new AppError(ErrorCode.VALIDATION_ERROR, GUEST_GENERIC);
    }

    return this.open(
      {
        sellerId: seller.id,
        buyerAccountId: account.id,
        amount: input.amount,
        channel: input.channel,
        createdByUserId: null,
      },
      input.channel,
    );
  }

  /** Misafir sayfasinin basligi: satici adi + hangi kanallar acik. */
  async publicSeller(sellerSlug: string) {
    const seller = await this.repo.sellerBySlug(sellerSlug);
    if (!seller?.isActive) throw new AppError(ErrorCode.NOT_FOUND, 'Satici bulunamadi');
    TenantContext.setSeller(seller.id);

    const [bankAccounts, pos] = await Promise.all([
      this.repo.activeBankAccounts(),
      this.repo.activePosConfig(),
    ]);

    return {
      name: seller.name,
      slug: seller.slug,
      logoUrl: seller.logoUrl,
      channels: {
        bankTransfer: bankAccounts.length > 0,
        // Kart yalniz saticinin AKTIF kendi POS'u varsa (kural #5).
        cardPos: Boolean(pos),
      },
    };
  }

  private async open(
    input: {
      sellerId: string;
      buyerAccountId: string;
      amount: MoneyString;
      channel: Channel;
      installmentCount?: number;
      createdByUserId: string | null;
    },
    channel: Channel,
  ) {
    const provider = this.providerFor(channel);
    const intent = await provider.createIntent(input);

    const bankAccounts =
      channel === CollectChannel.BANK_TRANSFER
        ? (await this.repo.activeBankAccounts()).map((a) => ({
            bankName: a.bankName,
            iban: a.iban,
            holderName: a.holderName,
          }))
        : [];

    // Kart kanalinda kullanici DOGRUDAN saglayicinin hosted 3D sayfasina gider (kural #5).
    const payment: CardPaymentStart | null =
      channel === CollectChannel.CARD_POS ? await this.cardPos.startPayment(intent.id) : null;

    await this.audit.log({
      action: 'COLLECT_INTENT_CREATED',
      entity: 'CollectIntent',
      entityId: intent.id,
      after: {
        amount: intent.amount,
        channel,
        referenceCode: intent.referenceCode,
        guest: input.createdByUserId === null,
      },
      sellerId: input.sellerId,
      actorUserId: input.createdByUserId,
    });

    return { intent, bankAccounts, payment };
  }

  // ---------------------------------------------------------------- listeleme

  async list(query: IntentListQuery, user: RequestUser) {
    const scoped: IntentListQuery =
      user.role === UserRole.BUYER_USER
        ? { ...query, buyerAccountId: user.buyerAccountId ?? '' }
        : query;

    const { skip, take } = paginate(scoped.page, scoped.limit);
    const { rows, total } = await this.repo.listIntents(scoped, skip, take);
    return Paginated.of(rows.map(toIntentDto), scoped.page, scoped.limit, total);
  }

  async findOne(id: string, user: RequestUser) {
    const intent = await this.repo.findIntent(id);
    if (!intent) throw new AppError(ErrorCode.NOT_FOUND);
    if (user.role === UserRole.BUYER_USER && intent.buyerAccountId !== user.buyerAccountId) {
      throw new AppError(ErrorCode.TENANT_FORBIDDEN);
    }

    const bankAccounts =
      intent.channel === CollectChannel.BANK_TRANSFER ? await this.repo.activeBankAccounts() : [];

    return {
      ...toIntentDto(intent),
      bankAccounts: bankAccounts.map((a) => ({
        bankName: a.bankName,
        iban: a.iban,
        holderName: a.holderName,
      })),
    };
  }

  // ---------------------------------------------------------------- onay / iptal

  /**
   * Panelde manuel onay (dekontu goren insan). Ekstre importu ve POS callback'i ayni
   * hatta akar (ReconciliationService) — burasi yalniz "kanit: insan" halidir.
   */
  async confirm(id: string, input: ConfirmIntentInput, user: RequestUser) {
    const intent = await this.repo.findIntent(id);
    if (!intent) throw new AppError(ErrorCode.NOT_FOUND);
    if (intent.status === 'CONFIRMED') throw new AppError(ErrorCode.ALREADY_CONFIRMED);
    if (intent.status === 'EXPIRED') throw new AppError(ErrorCode.INTENT_EXPIRED);
    if (intent.status === 'CANCELLED') {
      throw new AppError(ErrorCode.INTENT_NOT_PENDING, 'Odeme talebi iptal edilmis');
    }

    const provider = this.providerFor(intent.channel as Channel);
    return provider.reconcile({
      intentId: id,
      // Gerceklesen tutar verilmediyse talep tutari kadar tahsil edilmis sayilir.
      amount: input.amount ?? toMoney(intent.amount.toString()),
      actorUserId: user.userId,
      note: input.note,
    });
  }

  /** Kural #4: talep SILINMEZ, iptal edilir. Onaylanmis talep iptal edilemez. */
  async cancel(id: string, input: CancelIntentInput, user: RequestUser) {
    const intent = await this.repo.findIntent(id);
    if (!intent) throw new AppError(ErrorCode.NOT_FOUND);
    if (intent.status === 'CONFIRMED') {
      throw new AppError(
        ErrorCode.ALREADY_CONFIRMED,
        'Onaylanmis tahsilat iptal edilemez; ters kayit (iade) girin',
      );
    }
    if (user.role === UserRole.BUYER_USER && intent.buyerAccountId !== user.buyerAccountId) {
      throw new AppError(ErrorCode.TENANT_FORBIDDEN);
    }

    const result = await this.repo.cancelIntent(id);
    if (result.count === 0) throw new AppError(ErrorCode.INTENT_NOT_PENDING);

    await this.audit.log({
      action: 'COLLECT_INTENT_CANCELLED',
      entity: 'CollectIntent',
      entityId: id,
      before: { status: intent.status },
      after: { status: 'CANCELLED', reason: input.reason },
    });
    return { id, status: 'CANCELLED' as IntentStatus };
  }

  // ---------------------------------------------------------------- kart kanali

  installments(query: InstallmentQuery) {
    return this.cardPos.installments(query.amount, query.bin);
  }

  async startPayment(intentId: string, user: RequestUser) {
    const intent = await this.repo.findIntent(intentId);
    if (!intent) throw new AppError(ErrorCode.NOT_FOUND);
    if (user.role === UserRole.BUYER_USER && intent.buyerAccountId !== user.buyerAccountId) {
      throw new AppError(ErrorCode.TENANT_FORBIDDEN);
    }
    return this.cardPos.startPayment(intentId);
  }

  /**
   * §11.3 — POS callback: imza dogrulanmadan islenmez; dogrulanamayan istek ALARM uretir.
   * Idempotency ReconciliationService'te (ayni callback ikinci kez CREDIT yazamaz).
   */
  async posCallback(provider: string, body: unknown, ip: string | undefined) {
    this.assertCallbackIp(ip);

    try {
      const result = await this.cardPos.handleCallback(provider, body);
      if (!result) {
        this.logger.warn({ provider }, 'POS bildirimi: islem REDDEDILMIS (talep bekliyor)');
        return { processed: false, reason: 'DECLINED' };
      }
      return {
        processed: !result.alreadyConfirmed,
        alreadyConfirmed: result.alreadyConfirmed,
        intentId: result.intentId,
        transactionId: result.transactionId,
      };
    } catch (error) {
      if (error instanceof AppError && error.code === ErrorCode.POS_SIGNATURE_INVALID) {
        // Sessiz gecilmez: dogrulanamayan bildirim bir saldiri belirtisidir (§11.8).
        this.logger.error({ provider, ip, err: error }, 'POS bildirimi DOGRULANAMADI');
        await this.audit.log({
          action: 'POS_CALLBACK_REJECTED',
          entity: 'SellerPosConfig',
          after: { provider, ip: ip ?? null, reason: error.message },
        });
      }
      throw error;
    }
  }

  private assertCallbackIp(ip: string | undefined): void {
    const allowlist = this.config.get('POS_CALLBACK_IPS', { infer: true });
    if (!allowlist) return; // tanimli degilse IP kontrolu yok (§11.3 "mumkunse")

    const allowed = allowlist.split(',').map((entry) => entry.trim());
    if (!ip || !allowed.includes(ip)) {
      this.logger.error({ ip }, 'POS bildirimi allowlist disi IP');
      throw new AppError(ErrorCode.POS_SIGNATURE_INVALID, 'Bildirim kaynagi taninmadi');
    }
  }

  /** §11.1 — misafir uclarinda bot korumasi. Secret tanimli degilse (lokal) atlanir. */
  private async assertTurnstile(token: string | undefined): Promise<void> {
    const secret = this.config.get('TURNSTILE_SECRET', { infer: true });
    if (!secret) return;

    if (!token) throw new AppError(ErrorCode.VALIDATION_ERROR, 'Dogrulama tamamlanmadi');
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
    });
    const result = (await response.json()) as { success?: boolean };
    if (!result.success) throw new AppError(ErrorCode.VALIDATION_ERROR, 'Dogrulama basarisiz');
  }

  private providerFor(channel: Channel): CollectionProvider {
    return channel === CollectChannel.CARD_POS ? this.cardPos : this.bankTransfer;
  }
}

type IntentRow = CollectIntent & {
  buyerAccount?: { id: string; accountCode: string; title: string } | null;
};

/** Decimal → MoneyString (kural #1: sinirdan number cikmaz). */
function toIntentDto(row: IntentRow) {
  return {
    id: row.id,
    buyerAccountId: row.buyerAccountId,
    buyerAccount: row.buyerAccount ?? null,
    amount: toMoney(row.amount.toString()),
    currencyCode: row.currencyCode.trim(),
    channel: row.channel as Channel,
    status: row.status as IntentStatus,
    referenceCode: row.referenceCode,
    installmentCount: row.installmentCount,
    providerRef: row.providerRef,
    expiresAt: row.expiresAt,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
  };
}
