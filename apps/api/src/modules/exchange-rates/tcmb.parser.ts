import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { AppError, ErrorCode, toDecimal, toRate, type MoneyString } from '@carinet/shared';

/**
 * TCMB resmi kur servisi (§2: ucretsiz) — https://www.tcmb.gov.tr/kurlar/today.xml
 *
 * KRITIK (kural #1): kurlar XML'den STRING olarak alinir, asla parseFloat'tan gecmez.
 * "38,4210" gibi virgullu degerler de gelebilir → noktaya cevrilir, sonra decimal.js.
 */

export interface TcmbRate {
  currencyCode: string;
  /** Efektif satis yerine DOVIZ SATIS kullanilir: fatura/borc degerlemesi bunun uzerinden. */
  rate: MoneyString;
  date: Date;
}

/** Fatura ve bakiye degerlemesinde kullanilan para birimleri. */
const TRACKED = new Set(['USD', 'EUR', 'GBP', 'CHF', 'JPY']);

interface TcmbCurrency {
  '@_CurrencyCode'?: string;
  ForexSelling?: string | number;
  Unit?: string | number;
}

interface TcmbDocument {
  Tarih_Date?: {
    '@_Tarih'?: string;
    Currency?: TcmbCurrency[] | TcmbCurrency;
  };
}

@Injectable()
export class TcmbParser {
  private readonly parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

  parse(xml: string): TcmbRate[] {
    const doc = this.parser.parse(xml) as TcmbDocument;
    const root = doc.Tarih_Date;
    if (!root) throw new AppError(ErrorCode.VALIDATION_ERROR, 'TCMB yaniti taninmadi');

    const date = parseTcmbDate(root['@_Tarih']);
    const list = Array.isArray(root.Currency)
      ? root.Currency
      : root.Currency
        ? [root.Currency]
        : [];

    const rates: TcmbRate[] = [];
    for (const currency of list) {
      const code = currency['@_CurrencyCode'];
      if (!code || !TRACKED.has(code)) continue;

      const selling = normalizeNumber(currency.ForexSelling);
      const unit = normalizeNumber(currency.Unit) || '1';
      if (!selling) continue;

      // JPY gibi birimler 100 adet uzerinden kote edilir → BIRIM BASINA indirgenir.
      const perUnit = unit === '1' ? selling : divideStrings(selling, unit);
      rates.push({ currencyCode: code, rate: toRate(perUnit), date });
    }

    if (rates.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'TCMB yanitinda kur bulunamadi');
    }
    return rates;
  }
}

/** TCMB tarihi "14.07.2026" bicimindedir. */
function parseTcmbDate(raw: string | undefined): Date {
  if (!raw) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }
  const [day, month, year] = raw.split('.');
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

/** "38,4210" veya 38.421 → "38.4210". Sayiya CEVRILMEZ (kural #1). */
function normalizeNumber(value: string | number | undefined): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(text) ? text : null;
}

/** Bolme decimal.js ile — float aritmetigi kur hesabina sokulmaz (kural #1). */
function divideStrings(a: string, b: string): string {
  return toDecimal(a).dividedBy(toDecimal(b)).toString();
}
