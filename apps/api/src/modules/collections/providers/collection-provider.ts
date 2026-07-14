import { type CollectChannel, type IntentStatus, type MoneyString } from '@carinet/shared';

/**
 * CLAUDE.md §6.5 — tahsilat soyutlamasi.
 * Iki kanal (havale / satici POS'u) ayni arayuzu uygular ve onayda AYNI hatta birlesir:
 * CONFIRMED → otomatik CREDIT → bildirim → audit (§8).
 */

export interface CollectIntentInput {
  /** Misafir/callback yollarinda JWT yoktur → satici acikca tasinir (kural #3). */
  sellerId: string;
  buyerAccountId: string;
  amount: MoneyString;
  channel: CollectChannel;
  installmentCount?: number;
  /** Misafir sayfasindan aciliyorsa kullanici yok. */
  createdByUserId?: string | null;
}

export interface CollectIntentView {
  id: string;
  referenceCode: string;
  buyerAccountId: string | null;
  amount: MoneyString;
  currencyCode: string;
  channel: CollectChannel;
  status: IntentStatus;
  installmentCount: number | null;
  expiresAt: Date;
  createdAt: Date;
}

/** Onayin kaniti: hangi ekstre satiri veya hangi saglayici islemi bu tahsilati dogruluyor. */
export interface ReconcileInput {
  intentId: string;
  /** GERCEKLESEN tutar. Intent tutarindan farkli olabilir (§8 kismi/fazla odeme). */
  amount: MoneyString;
  /** Kanal 1: eslesen banka ekstresi satiri. */
  statementRowId?: string;
  /** Kanal 2: POS saglayicisinin islem referansi. */
  providerRef?: string;
  /** Islemi onaylayan kullanici (manuel onay / toplu onay). Callback'te yoktur. */
  actorUserId?: string | null;
  /** Dekont tarihi; yoksa bugun. */
  valueDate?: Date;
  note?: string;
}

export interface CollectionResult {
  intentId: string;
  status: IntentStatus;
  /** Olusan CREDIT hareketi. Idempotent tekrar cagrida MEVCUT hareketin id'si doner. */
  transactionId: string | null;
  creditedAmount: MoneyString;
  /** Kismi odemede kalan tutar icin acilan yeni bekleyen talep (§8). */
  remainderIntentId: string | null;
  /**
   * true → bu tahsilat DAHA ONCE islenmisti; bu cagri hicbir sey yazmadi.
   * Ekstre satiri, POS callback'i ve manuel onay ayni intent'i iki kez CREDIT'e ceviremez.
   */
  alreadyConfirmed: boolean;
}

export interface CollectionProvider {
  readonly channel: CollectChannel;
  createIntent(input: CollectIntentInput): Promise<CollectIntentView>;
  /** IDEMPOTENT (§6.5): ayni kanit ikinci kez geldiginde yeni kayit YAZILMAZ. */
  reconcile(evidence: ReconcileInput): Promise<CollectionResult>;
}
