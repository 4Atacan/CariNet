import { z } from 'zod';
import {
  DocumentType,
  TransactionType,
  documentTypeSchema,
  importSourceTypeSchema,
  importTargetSchema,
  transactionTypeSchema,
} from '../enums';
import {
  currencyCodeSchema,
  isNegative,
  isZero,
  moneySchema,
  negate,
  positiveMoneySchema,
  rateSchema,
  sub,
} from '../money';
import { paginationQuerySchema } from './common';
import { accountCodeSchema, vknTcknSchema } from './buyers';

/** Kolon eslemesi: kanonik alan → dosyadaki baslik. */
export const columnMappingSchema = z.record(z.string(), z.string()).optional();

/** Yukleme formu (multipart alanlari). Dosyanin kendisi Multer ile ayri gelir. */
export const importUploadSchema = z.object({
  target: importTargetSchema,
  sourceType: importSourceTypeSchema.default('EXCEL_GENERIC'),
  /** Otomatik esleme yetmezse kullanicinin duzelttigi esleme. */
  mapping: z
    .string()
    .optional()
    .transform((v) => (v ? (JSON.parse(v) as Record<string, string>) : undefined)),
  /** Kaydedilmis sablon (import_templates) ile ac. */
  templateId: z.string().optional(),
  /** Devir icin kesim tarihi (§9) — OPENING_BALANCES hedefinde zorunlu. */
  cutoffDate: z.coerce.date().optional(),
  sheetName: z.string().optional(),
});
export type ImportUploadInput = z.infer<typeof importUploadSchema>;

export const commitImportSchema = z.object({
  /** Hatali satirlar atlanarak commit edilsin mi? Varsayilan: HAYIR (once duzelt). */
  skipErrorRows: z.boolean().default(false),
  /** §9 Dogrulama Raporu: saticinin programindaki toplam. Fark varsa commit reddedilir. */
  expectedTotal: moneySchema.optional(),
});
export type CommitImportInput = z.infer<typeof commitImportSchema>;

export const cancelImportSchema = z.object({
  reason: z.string().min(3).max(300),
});
export type CancelImportInput = z.infer<typeof cancelImportSchema>;

export const saveTemplateSchema = z.object({
  name: z.string().min(2).max(60),
  sourceType: importSourceTypeSchema,
  target: importTargetSchema,
  mapping: z.record(z.string(), z.string()),
});
export type SaveTemplateInput = z.infer<typeof saveTemplateSchema>;

export const importRowsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['PENDING', 'VALID', 'ERROR', 'COMMITTED']).optional(),
});
export type ImportRowsQuery = z.infer<typeof importRowsQuerySchema>;

// ---------------------------------------------------------------- satir semalari (§6.6)
// Her satir staging'e girmeden ONCE bu semalardan gecer; hata satir no + sebep ile raporlanir.

export const buyerAccountRowSchema = z.object({
  accountCode: accountCodeSchema,
  title: z.string().min(2).max(200),
  vknTckn: vknTcknSchema.optional(),
  creditLimit: moneySchema.optional(),
  representative: z.string().max(120).optional(),
});
export type BuyerAccountRow = z.infer<typeof buyerAccountRowSchema>;

/**
 * Hareket satiri: ya (borc, alacak) kolonlari ya (tur, tutar) ikilisi gelir.
 * Ikisi de yoksa satir hatalidir. Yon ve tutar burada kanonik hale getirilir.
 */
export const transactionRowSchema = z
  .object({
    accountCode: accountCodeSchema,
    documentDate: z.coerce.date(),
    dueDate: z.coerce.date().optional(),
    documentNo: z.string().max(64).optional(),
    documentType: documentTypeSchema.default(DocumentType.OTHER),
    debit: moneySchema.optional(),
    credit: moneySchema.optional(),
    amount: positiveMoneySchema.optional(),
    type: transactionTypeSchema.optional(),
    description: z.string().max(500).optional(),
    currencyCode: currencyCodeSchema,
    exchangeRate: rateSchema.default('1'),
  })
  .transform((row, ctx) => {
    const direction = resolveDirection(row);
    if (!direction) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Satirda tutar yok: borc/alacak ya da tur+tutar kolonlari doldurulmali',
      });
      return z.NEVER;
    }
    return {
      accountCode: row.accountCode,
      documentDate: row.documentDate,
      dueDate: row.dueDate,
      documentNo: row.documentNo,
      documentType: row.documentType,
      description: row.description,
      currencyCode: row.currencyCode,
      exchangeRate: row.exchangeRate,
      ...direction,
    };
  });
export type TransactionRow = z.infer<typeof transactionRowSchema>;

/** Devir satiri (§9): tek OPENING_BALANCE hareketine donusur. */
export const openingBalanceRowSchema = z
  .object({
    accountCode: accountCodeSchema,
    title: z.string().min(2).max(200).optional(),
    vknTckn: vknTcknSchema.optional(),
    balance: moneySchema.optional(),
    debit: moneySchema.optional(),
    credit: moneySchema.optional(),
  })
  .transform((row, ctx) => {
    const direction = resolveDirection(row);
    if (!direction) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Devir tutari yok: bakiye ya da borc/alacak kolonu doldurulmali',
      });
      return z.NEVER;
    }
    return { accountCode: row.accountCode, title: row.title, vknTckn: row.vknTckn, ...direction };
  });
export type OpeningBalanceRow = z.infer<typeof openingBalanceRowSchema>;

// ---------------------------------------------------------------- UBL-TR (§9 altin kaynak)

/** Kural #7: UBL ayristirma ciktisi da bir dis sinirdir → Zod. */
export const ublInvoiceItemSchema = z.object({
  name: z.string().min(1).max(200),
  unit: z.string().max(16).default('ADET'),
  quantity: z.string(),
  unitPrice: moneySchema,
  taxRate: z.string(),
  netTotal: moneySchema,
  taxAmount: moneySchema,
  lineTotal: moneySchema,
});

export const ublInvoiceSchema = z.object({
  ublUuid: z.string().min(1),
  invoiceNo: z.string().min(1).max(64),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  currencyCode: currencyCodeSchema,
  exchangeRate: rateSchema.default('1'),
  /** Cari eslesmesi VKN ile yapilir — altin anahtar (§9). */
  buyerVkn: vknTcknSchema,
  buyerName: z.string().max(200).optional(),
  netTotal: moneySchema,
  taxTotal: moneySchema,
  grandTotal: positiveMoneySchema,
  items: z.array(ublInvoiceItemSchema).min(1),
});
export type UblInvoice = z.infer<typeof ublInvoiceSchema>;

/**
 * Yonu ve tutari tek yerde cozer:
 *   borc/alacak kolonlari → dolu olan yonu verir (ikisi de doluysa net fark alinir)
 *   bakiye kolonu → isaretli (pozitif = borc)
 *   tur + tutar → dogrudan
 * Sifir tutar anlamsizdir → null (satir hatasi).
 */
function resolveDirection(row: {
  debit?: string;
  credit?: string;
  amount?: string;
  balance?: string;
  type?: TransactionType;
}): { type: TransactionType; amount: string } | null {
  if (row.type && row.amount) return { type: row.type, amount: row.amount };

  const signed = signedTotal(row);
  if (signed === null || isZero(signed)) return null;

  // Kural #1: isaret/buyukluk ayrimi da decimal.js ile — string kesme veya float yok.
  return isNegative(signed)
    ? { type: TransactionType.CREDIT, amount: negate(signed) }
    : { type: TransactionType.DEBIT, amount: signed };
}

/** Net imzali toplam (pozitif = borc). Borc ve alacak ayni satirda dolu olabilir → net fark. */
function signedTotal(row: { debit?: string; credit?: string; balance?: string }): string | null {
  if (row.balance !== undefined) return row.balance;
  if (row.debit === undefined && row.credit === undefined) return null;
  return sub(row.debit ?? '0', row.credit ?? '0');
}
