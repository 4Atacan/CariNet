import { z } from 'zod';
import { moneySchema } from '../money';
import { paginationQuerySchema } from './common';

/** VKN 10, TCKN 11 hane (§9 — UBL eslesmesinin altin anahtari). */
export const vknTcknSchema = z.string().regex(/^\d{10}$|^\d{11}$/, 'VKN 10, TCKN 11 haneli olmali');

export const accountCodeSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9._-]+$/, 'Cari kodu harf, rakam, nokta, tire ve alt cizgi icerebilir');

export const createBuyerAccountSchema = z.object({
  accountCode: accountCodeSchema,
  title: z.string().min(2).max(200),
  vknTckn: vknTcknSchema.optional(),
  creditLimit: moneySchema.default('0'),
  representativeId: z.string().optional(),
  isActive: z.boolean().default(true),
});
export type CreateBuyerAccountInput = z.infer<typeof createBuyerAccountSchema>;

export const updateBuyerAccountSchema = createBuyerAccountSchema.partial();
export type UpdateBuyerAccountInput = z.infer<typeof updateBuyerAccountSchema>;

export const buyerListQuerySchema = paginationQuerySchema.extend({
  /** Unvan / cari kodu / VKN icinde arama. */
  q: z.string().trim().min(1).max(100).optional(),
  isActive: z.coerce.boolean().optional(),
  representativeId: z.string().optional(),
});
export type BuyerListQuery = z.infer<typeof buyerListQuerySchema>;

export const createRepresentativeSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(7).max(20).optional(),
  email: z.string().email().optional(),
});
export type CreateRepresentativeInput = z.infer<typeof createRepresentativeSchema>;

export const updateRepresentativeSchema = createRepresentativeSchema.partial();
export type UpdateRepresentativeInput = z.infer<typeof updateRepresentativeSchema>;
