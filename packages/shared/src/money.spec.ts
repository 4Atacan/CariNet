import { describe, expect, it } from 'vitest';
import {
  add,
  applyRate,
  computeBalance,
  computeRunningBalances,
  div,
  moneySchema,
  mul,
  positiveMoneySchema,
  rateSchema,
  sub,
  sum,
  toMoney,
  toRate,
} from './money';
import { TransactionType } from './enums';

describe('para aritmetigi (kural #1)', () => {
  it('float yuvarlama hatasi uretmez', () => {
    expect(add('0.1', '0.2')).toBe('0.30');
    expect(sub('1.00', '0.99')).toBe('0.01');
    // 0.1 + 0.2 === 0.30000000000000004 (float) — burada olmamali
    expect(add('0.1', '0.2')).not.toBe('0.30000000000000004');
  });

  it('buyuk tutarlarda kesinlik korur', () => {
    expect(add('9999999999999.99', '0.01')).toBe('10000000000000.00');
    expect(mul('123456789.12', '3')).toBe('370370367.36');
  });

  it('yarim yukari yuvarlar', () => {
    expect(toMoney('1.005')).toBe('1.01');
    expect(toMoney('2.344')).toBe('2.34');
    expect(toMoney('-1.005')).toBe('-1.01');
  });

  it('bolme ve sifira bolme', () => {
    expect(div('10', '3')).toBe('3.33');
    expect(() => div('10', '0')).toThrow(RangeError);
  });

  it('toplam alir', () => {
    expect(sum(['10.10', '20.20', '30.30'])).toBe('60.60');
    expect(sum([])).toBe('0.00');
  });

  it('kur 4 haneye yuvarlanir', () => {
    expect(toRate('38.123456')).toBe('38.1235');
    expect(applyRate('100.00', '38.1235')).toBe('3812.35');
  });
});

describe('bakiye turetme (kural #2)', () => {
  const movements = [
    { type: TransactionType.DEBIT, amount: '1000.00' }, // fatura
    { type: TransactionType.CREDIT, amount: '400.50' }, // tahsilat
    { type: TransactionType.DEBIT, amount: '250.25' },
  ];

  it('Bakiye = Σ(DEBIT) − Σ(CREDIT)', () => {
    expect(computeBalance(movements)).toBe('849.75');
  });

  it('hareket yoksa bakiye sifir', () => {
    expect(computeBalance([])).toBe('0.00');
  });

  it('alacakli alici negatif bakiye verir', () => {
    expect(
      computeBalance([
        { type: TransactionType.DEBIT, amount: '100.00' },
        { type: TransactionType.CREDIT, amount: '150.00' },
      ]),
    ).toBe('-50.00');
  });

  it('yuruyen bakiye kumulatiftir', () => {
    expect(computeRunningBalances(movements)).toEqual(['1000.00', '599.50', '849.75']);
  });
});

describe('sinir dogrulamasi (kural #7)', () => {
  it('gecerli parasal string kabul eder', () => {
    expect(moneySchema.parse('1234.5')).toBe('1234.50');
    expect(moneySchema.parse('-99')).toBe('-99.00');
  });

  it('3 ondalik hane, bilimsel gosterim ve harf reddedilir', () => {
    expect(() => moneySchema.parse('1.234')).toThrow();
    expect(() => moneySchema.parse('1e5')).toThrow();
    expect(() => moneySchema.parse('abc')).toThrow();
  });

  it('positiveMoneySchema sifiri reddeder', () => {
    expect(() => positiveMoneySchema.parse('0.00')).toThrow();
    expect(positiveMoneySchema.parse('0.01')).toBe('0.01');
  });

  it('rateSchema 4 haneye kadar izin verir', () => {
    expect(rateSchema.parse('38.1235')).toBe('38.1235');
    expect(() => rateSchema.parse('38.12345')).toThrow();
  });
});
