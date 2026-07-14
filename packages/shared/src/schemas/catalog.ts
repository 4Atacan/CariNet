import { z } from 'zod';
import { notificationTypeSchema, requestStatusSchema, requestTypeSchema } from '../enums';
import { currencyCodeSchema, moneySchema } from '../money';
import { paginationQuerySchema } from './common';

/** CLAUDE.md §13 Faz 4 — katalog, kampanya, bildirim, kur, talep-oneri (kural #7). */

// ---------------------------------------------------------------- urunler + stok

/** Stok miktari 4 ondalik (kg/litre gibi birimler icin) — para DEGIL ama yine de decimal. */
export const quantityStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,4})?$/, 'Miktar en fazla 4 ondalikli olmali');

export const createProductSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(2).max(200),
  unit: z.string().min(1).max(20).default('ADET'),
  price: moneySchema.optional(),
  currencyCode: currencyCodeSchema.default('TRY'),
  imageUrl: z.string().url().max(500).optional(),
  isActive: z.boolean().default(true),
  /** Urunle birlikte acilis stogu girilebilir. */
  quantity: quantityStringSchema.optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial().omit({ quantity: true });
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/** Stok DUZELTMESI degil, MUTLAK deger yazar — sayim sonucu girilir. */
export const setStockSchema = z.object({
  quantity: quantityStringSchema,
});
export type SetStockInput = z.infer<typeof setStockSchema>;

export const productListQuerySchema = paginationQuerySchema.extend({
  search: z.string().max(100).optional(),
  /** Vitrinde yalniz aktif urunler; panelde pasifler de gorunur. */
  onlyActive: z.coerce.boolean().optional(),
  inStock: z.coerce.boolean().optional(),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

// ---------------------------------------------------------------- kampanyalar

export const createCampaignSchema = z
  .object({
    title: z.string().min(3).max(150),
    body: z.string().min(3).max(2000),
    imageUrl: z.string().url().max(500).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((c) => c.endsAt > c.startsAt, {
    message: 'Bitis tarihi baslangictan sonra olmali',
    path: ['endsAt'],
  });
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const campaignListQuerySchema = paginationQuerySchema.extend({
  /** Mobil vitrin: yalniz su an yayinda olanlar. */
  activeOnly: z.coerce.boolean().optional(),
});
export type CampaignListQuery = z.infer<typeof campaignListQuerySchema>;

/** Duyuru: kampanyayi TUM alicilara push'lar (§13 Faz 4). */
export const announceCampaignSchema = z.object({
  /** Bos ise saticinin tum aktif carileri. */
  buyerAccountIds: z.array(z.string()).max(500).optional(),
});
export type AnnounceCampaignInput = z.infer<typeof announceCampaignSchema>;

// ---------------------------------------------------------------- bildirimler + push

export const notificationListQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
  type: notificationTypeSchema.optional(),
});
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

export const markReadSchema = z.object({
  ids: z.array(z.string()).min(1).max(200).optional(),
  /** Hepsini okundu isaretle (aktif hesap baglaminda). */
  all: z.boolean().default(false),
});
export type MarkReadInput = z.infer<typeof markReadSchema>;

/**
 * §6.2 — push token kullanici+cihaz bazlidir. Token bir SATICIYA bagli degildir;
 * bildirimin hangi hesaba ait oldugu payload'da tasinir.
 */
export const registerPushTokenSchema = z.object({
  token: z.string().min(10).max(200),
  platform: z.enum(['ios', 'android']),
  deviceName: z.string().max(100).optional(),
});
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

// ---------------------------------------------------------------- kurlar (TCMB)

export const exchangeRateQuerySchema = z.object({
  currencyCode: currencyCodeSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ExchangeRateQuery = z.infer<typeof exchangeRateQuerySchema>;

// ---------------------------------------------------------------- talep-oneri

export const createRequestSchema = z.object({
  type: requestTypeSchema.default('SUGGESTION'),
  subject: z.string().min(3).max(150),
  body: z.string().min(3).max(2000),
});
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const replyRequestSchema = z.object({
  reply: z.string().min(1).max(2000),
  status: requestStatusSchema.default('RESOLVED'),
});
export type ReplyRequestInput = z.infer<typeof replyRequestSchema>;

export const requestListQuerySchema = paginationQuerySchema.extend({
  status: requestStatusSchema.optional(),
  type: requestTypeSchema.optional(),
});
export type RequestListQuery = z.infer<typeof requestListQuerySchema>;

// ---------------------------------------------------------------- Excel disa aktarma

export const exportTargetSchema = z.enum(['BUYERS', 'TRANSACTIONS', 'PRODUCTS', 'RISK']);
export type ExportTarget = z.infer<typeof exportTargetSchema>;

export const exportQuerySchema = z.object({
  target: exportTargetSchema,
  buyerAccountId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;
