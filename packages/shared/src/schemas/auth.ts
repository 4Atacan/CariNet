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
  /** §11.1 — telefon kaybinda yedek kurtarma kodu (2FA yerine gecer, tek kullanimlik). */
  recoveryCode: z.string().trim().min(8).max(24).optional(),
  sellerCode: z.string().trim().min(1).max(64).optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

// -------------------------------------------------------------- 2FA kurulumu (§11.1)

/** Kurulumu baslat: aday secret + otpauth URL doner. Oturum + parola dogrulamasi gerekir. */
export const twoFactorSetupSchema = z.object({
  password: z.string().min(1, 'Sifre gerekli'),
});
export type TwoFactorSetupInput = z.infer<typeof twoFactorSetupSchema>;

/** Kurulumu tamamla: authenticator uygulamasindaki 6 haneli kodla aday secret dogrulanir. */
export const twoFactorEnableSchema = z.object({
  totp: z.string().regex(/^\d{6}$/, 'Dogrulama kodu 6 haneli olmali'),
});
export type TwoFactorEnableInput = z.infer<typeof twoFactorEnableSchema>;

/** 2FA'yi kapat: hem parola hem gecerli kod istenir (calinmis oturum tek basina kapatamasin). */
export const twoFactorDisableSchema = z.object({
  password: z.string().min(1, 'Sifre gerekli'),
  totp: z.string().regex(/^\d{6}$/, 'Dogrulama kodu 6 haneli olmali'),
});
export type TwoFactorDisableInput = z.infer<typeof twoFactorDisableSchema>;

export interface TwoFactorSetupResponse {
  /** Elle girme icin base32 secret. */
  secret: string;
  /** QR icin otpauth:// URI (panel/mobil QR olusturur). */
  otpauthUrl: string;
}

export interface TwoFactorEnableResponse {
  /** Tek seferlik gosterilen yedek kurtarma kodlari (duz metin — sonrasinda yalniz hash saklanir). */
  backupCodes: string[];
}

// -------------------------------------------------------------- hesap silme (§6.2 / §11.6 KVKK)

/** Hesabimi sil: parola dogrulamasi + acik onay ("HESABIMI SIL"). Kimlik anonimlestirilir. */
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Sifre gerekli'),
  confirm: z.literal('HESABIMI SIL', {
    errorMap: () => ({ message: 'Silmeyi onaylamak icin "HESABIMI SIL" yazin' }),
  }),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

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

/**
 * Satici personeli daveti (§6.2 + kural #11). Alici davetinden AYRI: hedefi cari degil
 * saticinin kendisi ve kabul akisi 2FA kurulumunu zorunlu olarak icerir.
 */
export const createSellerInviteSchema = z.object({
  sellerId: z.string().min(1),
  role: z.enum(['ADMIN', 'STAFF']).default('ADMIN'),
  expiresInHours: z.coerce.number().int().min(1).max(168).default(48),
});
export type CreateSellerInviteInput = z.infer<typeof createSellerInviteSchema>;

/** 1. adim: parola belirle → aday TOTP anahtari doner (hesap HENUZ acilmaz). */
export const startSellerInviteSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
export type StartSellerInviteInput = z.infer<typeof startSellerInviteSchema>;

/** 2. adim: kod dogrulanir ve hesap acilir. */
export const completeSellerInviteSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  totp: z.string().regex(/^[0-9]{6}$/, '6 haneli dogrulama kodu girin'),
});
export type CompleteSellerInviteInput = z.infer<typeof completeSellerInviteSchema>;

/** Platform yonetimi (PLATFORM_ADMIN) — satici kokunu olusturur. */
export const createSellerSchema = z.object({
  name: z.string().trim().min(2).max(160),
  /** Misafir odeme adresinde gorunur (§8: pay/{sellerSlug}) → kisa, kucuk harf, tireli. */
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Yalniz kucuk harf, rakam ve tire kullanin'),
});
export type CreateSellerInput = z.infer<typeof createSellerSchema>;

export const setSellerActiveSchema = z.object({ isActive: z.boolean() });
export type SetSellerActiveInput = z.infer<typeof setSellerActiveSchema>;

/** Oturum acikken parola degistirme (§11.1) — mevcut parola zorunlu. */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

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
  /**
   * YALNIZ satici daveti kabulunde dolar (§11.1). Yedek kurtarma kodlari bir kez donulur;
   * sonrasinda sunucuda yalniz sha256 hash'leri kalir, tekrar gosterilemez.
   */
  backupCodes?: string[];
}

/** Satici daveti — 1. adim yaniti: QR icin otpauth URL + elle giris icin anahtar. */
export interface SellerInviteStartResponse {
  sellerName: string;
  role: 'ADMIN' | 'STAFF';
  otpauthUrl: string;
  secret: string;
}
