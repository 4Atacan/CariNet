import { z } from 'zod';
import { userRoleSchema } from '../enums';

/** CLAUDE.md §6.2 / §6.3 — kuresel kimlik + uyelikler, JWT baglami. */

export const passwordSchema = z
  .string()
  .min(10, 'Sifre en az 10 karakter olmali')
  .max(128, 'Sifre en fazla 128 karakter olabilir');

export const emailSchema = z
  .string()
  .email('Gecerli bir e-posta adresi girin')
  .toLowerCase()
  .trim();

/**
 * Giris: e-posta + sifre (kuresel kimlik).
 * `sellerCode` yedek yol (§6.2): birden fazla uyelik varsa dogrudan o baglamla giris.
 * `totp` SELLER_ADMIN / PLATFORM_ADMIN icin (kural #11).
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Sifre gerekli'),
  totp: z
    .string()
    .regex(/^\d{6}$/, 'Dogrulama kodu 6 haneli olmali')
    .optional(),
  sellerCode: z.string().trim().min(1).max(64).optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(), // mobil govdeyle, panel cookie ile gonderir
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const switchAccountSchema = z.object({
  membershipId: z.string().min(1, 'Uyelik secilmeli'),
});
export type SwitchAccountInput = z.infer<typeof switchAccountSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Davet/QR akisi (§6.2): /j/{sellerSlug}/{token} → aktivasyon */
export const acceptInviteSchema = z.object({
  sellerSlug: z.string().min(1),
  token: z.string().min(1),
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, 'Gecerli bir telefon numarasi girin')
    .optional(),
  password: passwordSchema,
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const createInviteSchema = z.object({
  buyerAccountId: z.string().min(1),
  expiresInHours: z.coerce.number().int().min(1).max(720).default(168),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

/** JWT payload (§6.3) */
export const jwtPayloadSchema = z.object({
  sub: z.string(), // userId
  mem: z.string().nullable(), // membershipId (account_memberships | seller_members)
  role: userRoleSchema,
  sellerId: z.string().nullable(),
  buyerAccountId: z.string().nullable(), // yalniz BUYER_USER
  jti: z.string().optional(),
});
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

/** Hesap degistirici listesi ogesi */
export interface MembershipSummary {
  membershipId: string;
  kind: 'BUYER' | 'SELLER';
  role: z.infer<typeof userRoleSchema>;
  sellerId: string;
  sellerName: string;
  sellerSlug: string;
  buyerAccountId?: string;
  accountCode?: string;
  accountTitle?: string;
  lastActiveAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  role: z.infer<typeof userRoleSchema>;
  sellerId: string | null;
  buyerAccountId: string | null;
  membershipId: string | null;
}

export interface LoginResponse {
  tokens: AuthTokens;
  user: AuthenticatedUser;
  memberships: MembershipSummary[];
}
