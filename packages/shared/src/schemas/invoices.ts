import { z } from 'zod';
import { quantitySchema, taxRateSchema } from '../invoice';
import { currencyCodeSchema, positiveMoneySchema, rateSchema } from '../money';
import { dateRangeQuerySchema, paginationQuerySchema } from './common';

const isoDateSchema = z.coerce.date();

export const invoiceItemSchema = z.object({
  name: z.string().min(1).max(200),
  unit: z.string().min(1).max(16).default('ADET'),
  quantity: quantitySchema,
  unitPrice: positiveMoneySchema,
  taxRate: taxRateSchema.default('20'),
});
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;

export const createInvoiceSchema = z
  .object({
    buyerAccountId: z.string().min(1),
    invoiceNo: z.string().min(1).max(64),
    invoiceDate: isoDateSchema,
    dueDate: isoDateSchema.optional(),
    currencyCode: currencyCodeSchema,
    /** Kur satira sabitlenir; dovizli faturada zorunlu (§7). */
    exchangeRate: rateSchema.default('1'),
    items: z.array(invoiceItemSchema).min(1, 'Fatura en az bir kalem icermeli').max(500),
    description: z.string().max(500).optional(),
  })
  .refine((v) => v.currencyCode === 'TRY' || v.exchangeRate !== '1.0000', {
    message: 'Dovizli faturada kur girilmeli',
    path: ['exchangeRate'],
  })
  .refine((v) => !v.dueDate || v.dueDate >= v.invoiceDate, {
    message: 'Vade, fatura tarihinden once olamaz',
    path: ['dueDate'],
  });
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const invoiceListQuerySchema = paginationQuerySchema.merge(dateRangeQuerySchema).extend({
  buyerAccountId: z.string().optional(),
  q: z.string().trim().min(1).max(64).optional(),
  includeCancelled: z.coerce.boolean().default(false),
});
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;

/** Kural #4: fatura silinmez — iptal edilir, bagli DEBIT hareketi de iptal olur. */
export const cancelInvoiceSchema = z.object({
  reason: z.string().min(3).max(300),
});
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
