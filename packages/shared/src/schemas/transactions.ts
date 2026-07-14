import { z } from 'zod';
import { documentTypeSchema, transactionTypeSchema } from '../enums';
import { currencyCodeSchema, positiveMoneySchema, rateSchema } from '../money';
import { dateRangeQuerySchema, paginationQuerySchema } from './common';

/** Tarih sinirlarda ISO 8601 (§10). @db.Date kolonlarina gun hassasiyetinde yazilir. */
const isoDateSchema = z.coerce.date();

export const createTransactionSchema = z
  .object({
    buyerAccountId: z.string().min(1),
    type: transactionTypeSchema,
    documentType: documentTypeSchema,
    documentNo: z.string().max(64).optional(),
    documentDate: isoDateSchema,
    dueDate: isoDateSchema.optional(),
    /** Tutar daima pozitif; yon `type` ile belirlenir (kural #2). */
    amount: positiveMoneySchema,
    currencyCode: currencyCodeSchema,
    /** Kur kayit aninda satira sabitlenir (§7). TRY icin 1. */
    exchangeRate: rateSchema.default('1'),
    description: z.string().max(500).optional(),
  })
  .refine((v) => v.currencyCode === 'TRY' || v.exchangeRate !== '1.0000', {
    message: 'Dovizli harekette kur girilmeli',
    path: ['exchangeRate'],
  })
  .refine((v) => !v.dueDate || v.dueDate >= v.documentDate, {
    message: 'Vade, belge tarihinden once olamaz',
    path: ['dueDate'],
  });
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const transactionListQuerySchema = paginationQuerySchema.merge(dateRangeQuerySchema).extend({
  buyerAccountId: z.string().optional(),
  q: z.string().trim().min(1).max(64).optional(),
  type: transactionTypeSchema.optional(),
  documentType: documentTypeSchema.optional(),
  /** Iptal edilenler varsayilan olarak gizli (kural #4: silinmez, gizlenir). */
  includeCancelled: z.coerce.boolean().default(false),
});
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;

/** Kural #4: finansal kayit SILINMEZ — iptal edilir ve sebebi audit'e yazilir. */
export const cancelTransactionSchema = z.object({
  reason: z.string().min(3).max(300),
});
export type CancelTransactionInput = z.infer<typeof cancelTransactionSchema>;
