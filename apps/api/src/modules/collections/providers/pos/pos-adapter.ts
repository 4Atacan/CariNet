import { type MoneyString } from '@carinet/shared';

/**
 * CLAUDE.md kural #5 / §8 Kanal 2 — SATICININ KENDI POS'u, saglayicinin HOSTED 3D sayfasi.
 *
 * Bu arayuzun uygulamalari:
 *   · kart formu BARINDIRMAZ (kullanici saglayicinin sayfasina gider),
 *   · PAN/CVV GORMEZ, islemez, loglamaz,
 *   · para platform hesabina DEGIL, dogrudan saticinin hesabina akar.
 * Bizim tarafimizda kalan tek sey: imzali istek uretmek ve imzali bildirimi dogrulamak.
 */

export interface PosCredentials {
  provider: string;
  merchantId: string;
  apiKey: string;
  secret: string;
}

export interface HostedPaymentRequest {
  /** Saglayiciya "order id" olarak gider; callback bununla geri doner. */
  referenceCode: string;
  /** Karta cekilecek tutar (taksit vade farki DAHIL). */
  chargeAmount: MoneyString;
  installmentCount: number;
  callbackUrl: string;
  returnUrl: string;
}

/** Kullanici bu adrese gonderilir — kendi sitemizde kart alani YOKTUR. */
export interface HostedPaymentStart {
  hostedUrl: string;
  method: 'GET' | 'POST';
  fields: Record<string, string>;
}

export interface InstallmentOption {
  count: number;
  /** Karta cekilecek toplam (vade farki dahil). */
  totalAmount: MoneyString;
  monthlyAmount: MoneyString;
  /** Vade farki orani (%). Tek cekimde 0. */
  surchargePercent: number;
}

export interface PosCallbackResult {
  referenceCode: string;
  providerRef: string;
  /** Karta cekilen tutar. Cariye islenecek tutar DEGILDIR (bkz. collections.service). */
  chargedAmount: MoneyString;
  installmentCount: number;
  approved: boolean;
  /** Saglayicinin red gerekcesi (basarisiz islemde). */
  message?: string;
}

export interface PosAdapter {
  readonly name: string;
  /** Hosted 3D sayfasina yonlendirme paketi. */
  start(request: HostedPaymentRequest, credentials: PosCredentials): HostedPaymentStart;
  /** Taksit tablosu tutar (+ istege bagli BIN) ile saglayicidan gelir (§8). */
  installments(
    amount: MoneyString,
    bin: string | undefined,
    credentials: PosCredentials,
  ): InstallmentOption[];
  /**
   * §11.3 — imza DOGRULANMADAN hicbir sey islenmez. Imza tutmazsa firlatir.
   * Govde disaridan gelir → once Zod, sonra HMAC.
   */
  verifyCallback(body: unknown, credentials: PosCredentials): PosCallbackResult;
}
