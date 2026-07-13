import Decimal from 'decimal.js';
import { z } from 'zod';
import { TransactionType } from './enums';

/**
 * CLAUDE.md kural #1: Para asla float degildir.
 * Parasal alanlar DECIMAL(18,2), kurlar DECIMAL(18,4). Tasima bicimi: string.
 * `number` ile parasal aritmetik YASAK — bu modul disinda Decimal kurmayin.
 */

export const MONEY_SCALE = 2;
export const RATE_SCALE = 4;
export const DEFAULT_CURRENCY = 'TRY';

Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -9e15, toExpPos: 9e15 });

/** Parasal degerlerin tasima tipi: her zaman string ("1234.56"). */
export type MoneyString = string;

/** Decimal kurulabilen girdiler. `number` bilerek disarida — kural #1. */
export type MoneyInput = MoneyString | Decimal;

export function toDecimal(value: MoneyInput): Decimal {
  const d = value instanceof Decimal ? value : new Decimal(value);
  if (!d.isFinite()) {
    throw new TypeError(`Gecersiz parasal deger: ${String(value)}`);
  }
  return d;
}

/** 2 haneye yuvarlar (yarim yukari) ve string dondurur. */
export function toMoney(value: MoneyInput): MoneyString {
  return toDecimal(value).toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP).toFixed(MONEY_SCALE);
}

/** Kur: 4 hane. */
export function toRate(value: MoneyInput): MoneyString {
  return toDecimal(value).toDecimalPlaces(RATE_SCALE, Decimal.ROUND_HALF_UP).toFixed(RATE_SCALE);
}

export const add = (a: MoneyInput, b: MoneyInput): MoneyString =>
  toMoney(toDecimal(a).plus(toDecimal(b)));

export const sub = (a: MoneyInput, b: MoneyInput): MoneyString =>
  toMoney(toDecimal(a).minus(toDecimal(b)));

/** Tutar × kur / adet × birim fiyat. Sonuc parasal olarak 2 haneye yuvarlanir. */
export const mul = (a: MoneyInput, b: MoneyInput): MoneyString =>
  toMoney(toDecimal(a).times(toDecimal(b)));

export const div = (a: MoneyInput, b: MoneyInput): MoneyString => {
  const divisor = toDecimal(b);
  if (divisor.isZero()) throw new RangeError('Sifira bolme');
  return toMoney(toDecimal(a).dividedBy(divisor));
};

export const negate = (a: MoneyInput): MoneyString => toMoney(toDecimal(a).negated());

export const isZero = (a: MoneyInput): boolean => toDecimal(a).isZero();
export const isNegative = (a: MoneyInput): boolean => toDecimal(a).isNegative();
/** a > b */
export const gt = (a: MoneyInput, b: MoneyInput): boolean => toDecimal(a).greaterThan(toDecimal(b));
/** a >= b */
export const gte = (a: MoneyInput, b: MoneyInput): boolean =>
  toDecimal(a).greaterThanOrEqualTo(toDecimal(b));
/** a < b */
export const lt = (a: MoneyInput, b: MoneyInput): boolean => toDecimal(a).lessThan(toDecimal(b));
export const eq = (a: MoneyInput, b: MoneyInput): boolean => toDecimal(a).equals(toDecimal(b));

export const sum = (values: readonly MoneyInput[]): MoneyString =>
  toMoney(values.reduce<Decimal>((acc, v) => acc.plus(toDecimal(v)), new Decimal(0)));

/** Dovizli tutari TRY karsiligina cevirir (kur satira sabitlenmis olmali). */
export const applyRate = (amount: MoneyInput, rate: MoneyInput): MoneyString =>
  toMoney(toDecimal(amount).times(toDecimal(rate)));

export interface BalanceMovement {
  readonly type: TransactionType;
  readonly amount: MoneyInput;
}

/**
 * CLAUDE.md kural #2: Bakiye = Σ(DEBIT) − Σ(CREDIT). Turetilir, saklanmaz.
 * Pozitif = alici borclu.
 */
export function computeBalance(movements: readonly BalanceMovement[]): MoneyString {
  const total = movements.reduce<Decimal>((acc, m) => {
    const amount = toDecimal(m.amount);
    return m.type === TransactionType.DEBIT ? acc.plus(amount) : acc.minus(amount);
  }, new Decimal(0));
  return toMoney(total);
}

/** Yuruyen bakiye: her hareketten sonraki kumulatif bakiye (siralama cagirana ait). */
export function computeRunningBalances(movements: readonly BalanceMovement[]): MoneyString[] {
  let acc = new Decimal(0);
  return movements.map((m) => {
    const amount = toDecimal(m.amount);
    acc = m.type === TransactionType.DEBIT ? acc.plus(amount) : acc.minus(amount);
    return toMoney(acc);
  });
}

/** Arayuz gosterimi: 1.234,56 ₺ */
export function formatMoney(value: MoneyInput, currency: string = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    minimumFractionDigits: MONEY_SCALE,
    maximumFractionDigits: MONEY_SCALE,
  }).format(toDecimal(value).toNumber());
}

/** Sinirda gelen parasal string: "1234.56" / "-1234.5" / "1234". Bilimsel gosterim reddedilir. */
export const moneySchema = z
  .string()
  .regex(/^-?\d{1,16}(\.\d{1,2})?$/, 'Parasal deger en fazla 2 ondalik haneli olmali')
  .transform(toMoney);

export const positiveMoneySchema = moneySchema.refine((v) => toDecimal(v).greaterThan(0), {
  message: 'Tutar sifirdan buyuk olmali',
});

export const rateSchema = z
  .string()
  .regex(/^\d{1,14}(\.\d{1,4})?$/, 'Kur en fazla 4 ondalik haneli olmali')
  .transform(toRate);

export const currencyCodeSchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'Para birimi ISO 4217 (orn. TRY, USD)')
  .default(DEFAULT_CURRENCY);

export { Decimal };
