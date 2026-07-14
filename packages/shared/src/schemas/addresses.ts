import { z } from 'zod';

/** §7 addresses — cari hesabin teslimat/fatura adresleri. Finansal kayit degil → silinebilir. */
export const createAddressSchema = z.object({
  buyerAccountId: z.string().min(1),
  label: z.string().min(1).max(60),
  fullAddress: z.string().min(5).max(500),
  city: z.string().min(2).max(60),
});
export type CreateAddressInput = z.infer<typeof createAddressSchema>;

export const updateAddressSchema = createAddressSchema.omit({ buyerAccountId: true }).partial();
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
