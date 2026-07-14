import { toMoney, toRate, type MoneyString } from './money';

/**
 * §11.3 — "ekstre/Excel importu saldiri yuzeyidir".
 * Hucre degerleri Zod'dan ONCE burada normalize edilir: Turkce sayi/tarih bicimleri,
 * formul enjeksiyonu etkisizlestirme, Excel seri tarihleri.
 */

/** Excel hucresinden gelebilecek ham tipler. */
export type CellValue = string | number | boolean | Date | null | undefined;

/**
 * CSV/Excel formul enjeksiyonu: `=`, `+`, `-`, `@`, TAB, CR ile baslayan metin hucresi
 * disa aktarimda formul olarak calisir. Hem okurken hem yazarken etkisiz hale getirilir.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Metin hucresi: kirp, formulu etkisizlestir, bos ise undefined. */
export function cellToText(value: CellValue): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  if (text === '') return undefined;
  return neutralizeFormula(text);
}

/**
 * Parasal hucre → MoneyString. "1.234,56" (TR) ve "1234.56" (EN) desteklenir.
 * Sayisal hucre string'e cevrilip decimal.js'e verilir — aritmetik ASLA float'ta yapilmaz (kural #1).
 */
export function cellToMoney(value: CellValue): MoneyString | undefined {
  const raw = rawNumeric(value);
  if (raw === undefined) return undefined;
  try {
    return toMoney(raw);
  } catch {
    return undefined;
  }
}

export function cellToRate(value: CellValue): MoneyString | undefined {
  const raw = rawNumeric(value);
  if (raw === undefined) return undefined;
  try {
    return toRate(raw);
  } catch {
    return undefined;
  }
}

function rawNumeric(value: CellValue): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined;
    return value.toFixed(6); // sinirda tek seferlik cevrim; sonrasi decimal.js
  }
  if (typeof value !== 'string') return undefined;

  let text = value.trim().replace(/\s/g, '').replace(/[₺$€]/g, '');
  if (text === '') return undefined;

  // Parantezli negatif: (1.234,56) → -1234.56  (muhasebe disa aktarimlarinda yaygin)
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.startsWith('-')) {
    negative = true;
    text = text.slice(1);
  }

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');
  if (hasComma && hasDot) {
    // Son gelen ayirici ondaliktir: "1.234,56" → TR · "1,234.56" → EN
    text =
      text.lastIndexOf(',') > text.lastIndexOf('.')
        ? text.replaceAll('.', '').replace(',', '.')
        : text.replaceAll(',', '');
  } else if (hasComma) {
    text = text.replace(',', '.');
  }

  if (!/^\d*\.?\d*$/.test(text) || text === '' || text === '.') return undefined;
  return negative ? `-${text}` : text;
}

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30); // Excel'in 1900 artik yil hatasi dahil
const MS_PER_DAY = 86_400_000;

/** Tarih hucresi → UTC gun basi Date. "01.01.2026", "2026-01-01", Excel seri no ve Date destekli. */
export function cellToDate(value: CellValue): Date | undefined {
  if (value === null || value === undefined || value === '') return undefined;

  if (value instanceof Date) return atUtcMidnight(value);

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1 || value > 100_000) return undefined;
    return new Date(EXCEL_EPOCH_UTC + Math.round(value) * MS_PER_DAY);
  }

  const text = String(value).trim();

  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (dmy) return utcDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));

  const ymd = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/.exec(text);
  if (ymd) return utcDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));

  return undefined;
}

function utcDate(year: number, month: number, day: number): Date | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const d = new Date(Date.UTC(year, month - 1, day));
  // 31.02.2026 gibi tasan tarihleri reddet
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return undefined;
  return d;
}

const atUtcMidnight = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
