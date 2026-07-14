import { Injectable } from '@nestjs/common';
import { CollectChannel, toMoney } from '@carinet/shared';
import { IntentFactory } from '../intent-factory.service';
import { ReconciliationService } from '../reconciliation.service';
import {
  type CollectIntentInput,
  type CollectIntentView,
  type CollectionProvider,
  type CollectionResult,
  type ReconcileInput,
} from './collection-provider';

/**
 * §8 Kanal 1 — Havale/EFT/FAST + referans eslestirme. Komisyon 0, VARSAYILAN kanal.
 * Platform para akisina girmez: alici parayi DOGRUDAN saticinin IBAN'ina gonderir (kural #5).
 * Bizim isimiz: benzersiz referans kodu uretmek ve dekont geldiginde eslestirmek.
 */
@Injectable()
export class BankTransferProvider implements CollectionProvider {
  readonly channel = CollectChannel.BANK_TRANSFER;

  constructor(
    private readonly intents: IntentFactory,
    private readonly reconciliation: ReconciliationService,
  ) {}

  async createIntent(input: CollectIntentInput): Promise<CollectIntentView> {
    const intent = await this.intents.createPending({
      sellerId: input.sellerId,
      buyerAccountId: input.buyerAccountId,
      amount: input.amount,
      channel: CollectChannel.BANK_TRANSFER,
      createdByUserId: input.createdByUserId,
    });

    return {
      id: intent.id,
      referenceCode: intent.referenceCode,
      buyerAccountId: intent.buyerAccountId,
      amount: toMoney(intent.amount.toString()),
      currencyCode: intent.currencyCode.trim(),
      channel: CollectChannel.BANK_TRANSFER,
      status: 'PENDING',
      installmentCount: null,
      expiresAt: intent.expiresAt,
      createdAt: intent.createdAt,
    };
  }

  /** Kanit: banka ekstresi satiri veya insan onayi. Idempotent — ortak hat (§8). */
  reconcile(evidence: ReconcileInput): Promise<CollectionResult> {
    return this.reconciliation.apply(evidence, CollectChannel.BANK_TRANSFER);
  }
}
