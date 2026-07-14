import { describe, expect, it } from 'vitest';
import { computeInvoiceTotals, computeLineTotals, quantitySchema, taxRateSchema } from './invoice';

describe('computeLineTotals', () => {
  it('net = miktar x birim fiyat, KDV net uzerinden', () => {
    expect(computeLineTotals({ quantity: '3', unitPrice: '100.00', taxRate: '20' })).toEqual({
      netTotal: '300.00',
      taxAmount: '60.00',
      lineTotal: '360.00',
    });
  });

  it('kesirli miktarda float hatasi olusmaz (0.1 + 0.2 tuzagi)', () => {
    // 0.1 * 0.2 = 0.02 — float aritmetiginde 0.020000000000000004
    expect(computeLineTotals({ quantity: '0.1', unitPrice: '0.20', taxRate: '0' }).netTotal).toBe(
      '0.02',
    );
  });

  it('KDV yarim yukari yuvarlanir', () => {
    // 12.35 x 1 = 12.35 → %10 KDV = 1.235 → 1.24
    expect(computeLineTotals({ quantity: '1', unitPrice: '12.35', taxRate: '10' }).taxAmount).toBe(
      '1.24',
    );
  });

  it('ondalikli KDV orani desteklenir', () => {
    expect(computeLineTotals({ quantity: '2', unitPrice: '50.00', taxRate: '10.5' })).toEqual({
      netTotal: '100.00',
      taxAmount: '10.50',
      lineTotal: '110.50',
    });
  });
});

describe('computeInvoiceTotals', () => {
  it('toplamlar yuvarlanmis satirlarin toplamidir (kurus farki olusmaz)', () => {
    const totals = computeInvoiceTotals([
      { quantity: '1', unitPrice: '12.35', taxRate: '10' }, // 12.35 + 1.24 = 13.59
      { quantity: '1', unitPrice: '12.35', taxRate: '10' }, // 12.35 + 1.24 = 13.59
      { quantity: '1', unitPrice: '12.35', taxRate: '10' }, // 12.35 + 1.24 = 13.59
    ]);
    expect(totals.netTotal).toBe('37.05');
    expect(totals.taxTotal).toBe('3.72');
    expect(totals.grandTotal).toBe('40.77');
    // net + kdv = genel toplam (satir bazli yuvarlama sayesinde birebir tutar)
    expect(totals.grandTotal).toBe('40.77');
    expect(totals.lines).toHaveLength(3);
  });

  it('cok kalemli faturada net + kdv = genel toplam', () => {
    const totals = computeInvoiceTotals([
      { quantity: '3.5', unitPrice: '19.99', taxRate: '20' },
      { quantity: '10', unitPrice: '4.75', taxRate: '10' },
      { quantity: '0.25', unitPrice: '1000.00', taxRate: '1' },
    ]);
    const net = Number(totals.netTotal);
    const tax = Number(totals.taxTotal);
    expect(Number(totals.grandTotal).toFixed(2)).toBe((net + tax).toFixed(2));
  });
});

describe('sinir semalari', () => {
  it('miktar 4 haneden fazla ondalik kabul etmez', () => {
    expect(quantitySchema.safeParse('1.12345').success).toBe(false);
    expect(quantitySchema.safeParse('1.1234').success).toBe(true);
  });

  it('miktar sifir veya negatif olamaz', () => {
    expect(quantitySchema.safeParse('0').success).toBe(false);
    expect(quantitySchema.safeParse('-1').success).toBe(false);
  });

  it('KDV orani %100u asamaz', () => {
    expect(taxRateSchema.safeParse('101').success).toBe(false);
    expect(taxRateSchema.safeParse('20').success).toBe(true);
    expect(taxRateSchema.safeParse('0').success).toBe(true);
  });
});
