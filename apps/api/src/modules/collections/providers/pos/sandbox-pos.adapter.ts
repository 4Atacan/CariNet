import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { AppError, ErrorCode, add, div, mul, toMoney, type MoneyString } from '@carinet/shared';
import { type Env } from '../../../../config/env';
import {
  type HostedPaymentRequest,
  type HostedPaymentStart,
  type InstallmentOption,
  type PosAdapter,
  type PosCallbackResult,
  type PosCredentials,
} from './pos-adapter';

/**
 * Sandbox POS — gercek bir saglayicinin yerine gecen referans uygulamasi.
 * §8: "Adaptorler talep geldikce eklenir; ilki pilot saticinin saglayicisina gore yazilir."
 * Pilotun saglayicisi belli olana kadar TEK adaptor budur; hosted 3D sayfasi bizim
 * degil saglayicinin adresidir (POS_SANDBOX_HOSTED_URL) — kural #5.
 *
 * Imza semasi (gercek saglayicilarin deseniyle ayni): HMAC-SHA256(secret, alanlar|birlestirilmis).
 */

/** Taksit tablosu — gercekte saglayicidan gelir; sandbox'ta sabit vade farki oranlari. */
const INSTALLMENT_TABLE: readonly { count: number; surchargePercent: number }[] = [
  { count: 1, surchargePercent: 0 },
  { count: 3, surchargePercent: 2 },
  { count: 6, surchargePercent: 4 },
  { count: 9, surchargePercent: 6.5 },
  { count: 12, surchargePercent: 9 },
];

/** Saglayicidan gelen bildirim — dis sinir, once Zod (kural #7). */
const callbackSchema = z.object({
  merchantId: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.string().regex(/^\d+\.\d{2}$/),
  installmentCount: z.coerce.number().int().min(1).max(12),
  status: z.enum(['APPROVED', 'DECLINED']),
  providerRef: z.string().min(1),
  message: z.string().max(200).optional(),
  signature: z.string().min(16),
});

@Injectable()
export class SandboxPosAdapter implements PosAdapter {
  readonly name = 'SANDBOX';

  constructor(private readonly config: ConfigService<Env, true>) {}

  start(request: HostedPaymentRequest, credentials: PosCredentials): HostedPaymentStart {
    const merchantId = credentials.merchantId;
    const orderId = request.referenceCode;
    const amount = request.chargeAmount;
    const installmentCount = String(request.installmentCount);

    const fields: Record<string, string> = {
      merchantId,
      orderId,
      amount,
      installmentCount,
      callbackUrl: request.callbackUrl,
      returnUrl: request.returnUrl,
      signature: sign([merchantId, orderId, amount, installmentCount], credentials.secret),
    };

    return {
      // Kart alanlari SAGLAYICININ sayfasindadir; biz yalniz yonlendiririz (kural #5).
      hostedUrl: this.config.get('POS_SANDBOX_HOSTED_URL', { infer: true }),
      method: 'POST',
      fields,
    };
  }

  installments(
    amount: MoneyString,
    _bin: string | undefined,
    _c: PosCredentials,
  ): InstallmentOption[] {
    // Gercek adaptorde BIN saglayiciya sorulur (banka/kart tipine gore tablo degisir).
    // BIN saklanmaz ve loglanmaz — PAN degildir ama kart verisi hijyeni ayni (kural #5).
    return INSTALLMENT_TABLE.map(({ count, surchargePercent }) => {
      const surcharge = mul(amount, div(String(surchargePercent), '100'));
      const totalAmount = add(amount, surcharge);
      return {
        count,
        totalAmount,
        monthlyAmount: div(totalAmount, String(count)),
        surchargePercent,
      };
    });
  }

  verifyCallback(body: unknown, credentials: PosCredentials): PosCallbackResult {
    const parsed = callbackSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(ErrorCode.POS_SIGNATURE_INVALID, 'Bildirim govdesi taninmadi');
    }
    const data = parsed.data;

    if (data.merchantId !== credentials.merchantId) {
      throw new AppError(ErrorCode.POS_SIGNATURE_INVALID, 'Uye isyeri numarasi eslesmiyor');
    }

    const expected = sign(
      [data.merchantId, data.orderId, data.amount, data.status, data.providerRef],
      credentials.secret,
    );
    if (!safeEquals(expected, data.signature)) {
      throw new AppError(ErrorCode.POS_SIGNATURE_INVALID);
    }

    return {
      referenceCode: data.orderId,
      providerRef: data.providerRef,
      chargedAmount: toMoney(data.amount),
      installmentCount: data.installmentCount,
      approved: data.status === 'APPROVED',
      message: data.message,
    };
  }
}

const sign = (parts: readonly string[], secret: string): string =>
  createHmac('sha256', secret).update(parts.join('|')).digest('hex');

/** Imza karsilastirmasi sabit zamanli olmali (timing attack). */
function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}
