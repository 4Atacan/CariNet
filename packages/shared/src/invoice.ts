import { z } from 'zod';
import { div, mul, sum, toDecimal, toMoney, type MoneyInput, type MoneyString } from './money';

/**
 * Fatura kalem/toplam hesabi — kural #1: her adim decimal.js, `number` yok.
 * Yuvarlama SATIR bazinda yapilir (KDV dahil), toplamlar yuvarlanmis satirlarin toplamidir;
 * boylece "kalemler toplami ≠ fatura toplami" kurus farki olusmaz.
 */

/** Miktar 4 ondalik haneli (invoice_items.quantity DECIMAL(18,4)). */
export const quantitySchema = z
  .string()
  .regex(/^\d{1,14}(\.\d{1,4})?$/, 'Miktar en fazla 4 ondalik haneli olmali')
  .refine((v) => toDecimal(v).greaterThan(0), { message: 'Miktar sifirdan buyuk olmali' });

/** KDV orani yuzde olarak: "20", "10.5" (DECIMAL(5,2)). */
export const taxRateSchema = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, 'KDV orani en fazla 2 ondalik haneli olmali')
  .refine((v) => toDecimal(v).lessThanOrEqualTo(100), { message: 'KDV orani %100u asamaz' });

export interface InvoiceLineInput {
  readonly quantity: MoneyInput;
  readonly unitPrice: MoneyInput;
  readonly taxRate: MoneyInput;
}

export interface InvoiceLineTotals {
  readonly netTotal: MoneyString;
  readonly taxAmount: MoneyString;
  readonly lineTotal: MoneyString;
}

export interface InvoiceTotals {
  readonly netTotal: MoneyString;
  readonly taxTotal: MoneyString;
  readonly grandTotal: MoneyString;
  readonly lines: readonly InvoiceLineTotals[];
}

export function computeLineTotals(line: InvoiceLineInput): InvoiceLineTotals {
  const netTotal = mul(line.quantity, line.unitPrice);
  const taxAmount = div(mul(netTotal, line.taxRate), '100');
  return { netTotal, taxAmount, lineTotal: toMoney(toDecimal(netTotal).plus(taxAmount)) };
}

export function computeInvoiceTotals(lines: readonly InvoiceLineInput[]): InvoiceTotals {
  const computed = lines.map(computeLineTotals);
  return {
    netTotal: sum(computed.map((l) => l.netTotal)),
    taxTotal: sum(computed.map((l) => l.taxAmount)),
    grandTotal: sum(computed.map((l) => l.lineTotal)),
    lines: computed,
  };
}
