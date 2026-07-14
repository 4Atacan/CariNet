import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { type CollectIntent } from '@prisma/client';
import {
  AppError,
  DEFAULT_CURRENCY,
  ErrorCode,
  buildReferenceCode,
  toMoney,
  type CollectChannel,
  type MoneyString,
} from '@carinet/shared';
import { type TxClient } from '../../prisma/prisma.module';
import { CollectionsRepository } from './collections.repository';

/** §8 — bekleyen talep 72 saatte otomatik EXPIRED olur. */
export const INTENT_TTL_HOURS = 72;

export interface CreatePendingIntent {
  sellerId: string;
  buyerAccountId: string;
  amount: MoneyString;
  channel: CollectChannel;
  installmentCount?: number;
  createdByUserId?: string | null;
}

/**
 * Bekleyen tahsilat talebi uretir. Iki kanal da (havale + POS) ayni talebi acar;
 * fark yalniz onay yolundadir (§8). Kismi odemede kalan tutar icin de burasi kullanilir.
 */
@Injectable()
export class IntentFactory {
  constructor(private readonly repo: CollectionsRepository) {}

  async createPending(input: CreatePendingIntent, tx?: TxClient): Promise<CollectIntent> {
    const account = await this.repo.findAccount(input.buyerAccountId, tx);
    if (!account) throw new AppError(ErrorCode.NOT_FOUND, 'Cari hesap bulunamadi');
    if (!account.isActive) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Pasif cari hesap icin odeme alinamaz');
    }

    const seller = await this.repo.seller(input.sellerId);
    if (!seller) throw new AppError(ErrorCode.NOT_FOUND, 'Satici bulunamadi');
    if (!seller.isActive) throw new AppError(ErrorCode.SELLER_INACTIVE);

    const expiresAt = new Date(Date.now() + INTENT_TTL_HOURS * 60 * 60 * 1000);

    // Referans kodu benzersizdir (DB unique). CSPRNG carpismasi pratikte imkansiz ama
    // yine de birkac kez denenir — kullanicinin onune "kod uretilemedi" hatasi cikmasin.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const referenceCode = buildReferenceCode(
        seller.sellerNo,
        account.accountCode,
        randomSuffix(),
      );
      const existing = await this.repo.findIntentByReference(referenceCode);
      if (existing) continue;

      return this.repo.createIntent(
        {
          buyerAccountId: account.id,
          amount: toMoney(input.amount),
          currencyCode: DEFAULT_CURRENCY,
          channel: input.channel,
          referenceCode,
          installmentCount: input.channel === 'CARD_POS' ? (input.installmentCount ?? 1) : null,
          status: 'PENDING',
          expiresAt,
        },
        tx,
      );
    }

    throw new AppError(ErrorCode.INTERNAL_ERROR, 'Referans kodu uretilemedi');
  }
}

/** §11.3 — referans kodu CSPRNG ile uretilir (tahmin edilebilir kod = sahte dekont riski). */
function randomSuffix(): string {
  return randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
}
