import { z } from 'zod';
import { isValidIban, normalizeIban } from '../collections';
import { collectChannelSchema, intentStatusSchema } from '../enums';
import { positiveMoneySchema } from '../money';
import { paginationQuerySchema } from './common';

/** CLAUDE.md §8 — tahsilat uclarinin dis sinir semalari (kural #7). */

// ---------------------------------------------------------------- intent

/**
 * Tahsilat TRY'dir: bakiye TRY uzerinden turetilir (§6.4) ve tahsilat aninda dovize
 * kur uygulamak icin gunluk TCMB kuru gerekir (Faz 4). Dovizli faturasi olan alici
 * TRY karsiligini oder — CREDIT satiri TRY yazilir, bakiye dogru duser.
 */
export const createIntentSchema = z.object({
  /** Panelden aciliyorsa zorunlu; alici kendi adina aciyorsa JWT'den gelir. */
  buyerAccountId: z.string().optional(),
  amount: positiveMoneySchema,
  channel: collectChannelSchema.default('BANK_TRANSFER'),
  /** Yalniz CARD_POS: 1 = tek cekim. */
  installmentCount: z.coerce.number().int().min(1).max(12).optional(),
});
export type CreateIntentInput = z.infer<typeof createIntentSchema>;

/** Misafir odeme (§8 `pay/{sellerSlug}`): kimlik yok, cari kodu ile. */
export const guestIntentSchema = z.object({
  accountCode: z.string().min(1).max(50),
  amount: positiveMoneySchema,
  channel: collectChannelSchema.default('BANK_TRANSFER'),
  /** Cloudflare Turnstile (§11.1). Prod'da zorunlu, lokalde bos gecilebilir. */
  turnstileToken: z.string().optional(),
});
export type GuestIntentInput = z.infer<typeof guestIntentSchema>;

/**
 * Manuel onay. `amount` verilirse GERCEKLESEN tutar odur (§8 kismi odeme):
 * fark kadar yeni bir bekleyen intent acilir.
 */
export const confirmIntentSchema = z.object({
  amount: positiveMoneySchema.optional(),
  note: z.string().max(500).optional(),
});
export type ConfirmIntentInput = z.infer<typeof confirmIntentSchema>;

export const cancelIntentSchema = z.object({
  reason: z.string().min(3).max(500),
});
export type CancelIntentInput = z.infer<typeof cancelIntentSchema>;

export const intentListQuerySchema = paginationQuerySchema.extend({
  status: intentStatusSchema.optional(),
  buyerAccountId: z.string().optional(),
});
export type IntentListQuery = z.infer<typeof intentListQuerySchema>;

// ---------------------------------------------------------------- ekstre eslestirme

/**
 * Toplu onay. Her satir ya bir intent'e ya da dogrudan bir cariye baglanir
 * (aciklamasiz dekont: insan cariyi secer, sistem intent'i kendi acar → tek hat).
 */
export const bulkConfirmSchema = z.object({
  matches: z
    .array(
      z
        .object({
          rowId: z.string(),
          intentId: z.string().optional(),
          buyerAccountId: z.string().optional(),
        })
        .refine((m) => Boolean(m.intentId ?? m.buyerAccountId), {
          message: 'Satir bir tahsilata veya cariye baglanmali',
        }),
    )
    .min(1)
    .max(200),
});
export type BulkConfirmInput = z.infer<typeof bulkConfirmSchema>;

/** Banka ekstresi satiri — CSV/Excel'den gelir, hucreler cellTo* ile sadelestirilmis olur. */
export const bankStatementRowSchema = z.object({
  txDate: z.coerce.date(),
  description: z.string().min(1).max(500),
  amount: positiveMoneySchema,
});
export type BankStatementRowInput = z.infer<typeof bankStatementRowSchema>;

// ---------------------------------------------------------------- satici ayarlari

export const ibanSchema = z
  .string()
  .transform(normalizeIban)
  .refine(isValidIban, { message: 'IBAN gecersiz (kontrol hanesi tutmuyor)' });

export const bankAccountSchema = z.object({
  bankName: z.string().min(2).max(100),
  iban: ibanSchema,
  holderName: z.string().min(2).max(150),
  isActive: z.boolean().default(true),
  /** §11.3 — IBAN degisikligi kritik islemdir: 2FA + audit. */
  totp: z.string().length(6).optional(),
});
export type BankAccountInput = z.infer<typeof bankAccountSchema>;

export const posConfigSchema = z.object({
  provider: z.string().min(2).max(50),
  merchantId: z.string().min(1).max(100),
  apiKey: z.string().min(1).max(500),
  secret: z.string().min(1).max(500),
  isActive: z.boolean().default(false),
  /** §11.3 — POS anahtari degisikligi kritik islemdir: 2FA + audit. */
  totp: z.string().length(6).optional(),
});
export type PosConfigInput = z.infer<typeof posConfigSchema>;

/** Taksit secenekleri saglayicidan tutar/BIN ile cekilir (§8). */
export const installmentQuerySchema = z.object({
  amount: positiveMoneySchema,
  bin: z
    .string()
    .regex(/^\d{6,8}$/, 'BIN 6-8 hane olmali')
    .optional(),
});
export type InstallmentQuery = z.infer<typeof installmentQuerySchema>;
