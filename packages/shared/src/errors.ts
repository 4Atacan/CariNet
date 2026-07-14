/**
 * CLAUDE.md §10 — hata sozlesmesi.
 * Yanit zarfi: { success: false, error: { code, message } }  (message: Turkce)
 */

export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TENANT_FORBIDDEN: 'TENANT_FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REUSED: 'TOKEN_REUSED',
  TOTP_REQUIRED: 'TOTP_REQUIRED',
  TOTP_INVALID: 'TOTP_INVALID',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  MEMBERSHIP_NOT_FOUND: 'MEMBERSHIP_NOT_FOUND',
  INVITE_INVALID: 'INVITE_INVALID',
  INVITE_EXPIRED: 'INVITE_EXPIRED',
  PASSWORD_COMPROMISED: 'PASSWORD_COMPROMISED',

  // is kurallari
  CREDIT_LIMIT_EXCEEDED: 'CREDIT_LIMIT_EXCEEDED',
  INTENT_EXPIRED: 'INTENT_EXPIRED',
  ALREADY_CONFIRMED: 'ALREADY_CONFIRMED',
  IMPORT_ROW_ERRORS: 'IMPORT_ROW_ERRORS',
  SELLER_INACTIVE: 'SELLER_INACTIVE',

  // tahsilat (§8)
  INTENT_NOT_PENDING: 'INTENT_NOT_PENDING',
  ROW_ALREADY_MATCHED: 'ROW_ALREADY_MATCHED',
  POS_NOT_CONFIGURED: 'POS_NOT_CONFIGURED',
  POS_SIGNATURE_INVALID: 'POS_SIGNATURE_INVALID',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Varsayilan Turkce mesajlar. Servis kendi mesajini gecebilir. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Gonderilen veri gecerli degil.',
  UNAUTHORIZED: 'Oturum acmaniz gerekiyor.',
  FORBIDDEN: 'Bu islem icin yetkiniz yok.',
  TENANT_FORBIDDEN: 'Bu kayda erisim yetkiniz yok.',
  NOT_FOUND: 'Kayit bulunamadi.',
  CONFLICT: 'Kayit zaten mevcut.',
  RATE_LIMITED: 'Cok fazla istek gonderdiniz. Lutfen biraz bekleyin.',
  INTERNAL_ERROR: 'Beklenmeyen bir hata olustu.',

  INVALID_CREDENTIALS: 'E-posta veya sifre hatali.',
  TOKEN_EXPIRED: 'Oturumunuzun suresi doldu. Lutfen tekrar giris yapin.',
  TOKEN_REUSED: 'Guvenlik nedeniyle tum oturumlariniz sonlandirildi.',
  TOTP_REQUIRED: 'Iki adimli dogrulama kodu gerekli.',
  TOTP_INVALID: 'Dogrulama kodu hatali.',
  ACCOUNT_INACTIVE: 'Hesabiniz pasif durumda.',
  MEMBERSHIP_NOT_FOUND: 'Bu hesaba erisiminiz yok.',
  INVITE_INVALID: 'Davet baglantisi gecersiz.',
  INVITE_EXPIRED: 'Davet baglantisinin suresi dolmus.',
  PASSWORD_COMPROMISED: 'Bu sifre veri sizintilarinda tespit edildi. Baska bir sifre secin.',

  CREDIT_LIMIT_EXCEEDED: 'Kredi limiti asildi.',
  INTENT_EXPIRED: 'Odeme talebinin suresi dolmus.',
  ALREADY_CONFIRMED: 'Bu odeme zaten onaylanmis.',
  IMPORT_ROW_ERRORS: 'Yuklenen dosyada hatali satirlar var.',
  SELLER_INACTIVE: 'Satici firma pasif durumda.',

  INTENT_NOT_PENDING: 'Bu odeme talebi artik bekleyen durumda degil.',
  ROW_ALREADY_MATCHED: 'Bu ekstre satiri zaten bir tahsilatla eslestirilmis.',
  POS_NOT_CONFIGURED: 'Satici firmanin aktif bir sanal POS tanimi yok.',
  POS_SIGNATURE_INVALID: 'Odeme saglayicisindan gelen bildirim dogrulanamadi.',
};

export const HTTP_STATUS_BY_ERROR_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  TENANT_FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,

  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_REUSED: 401,
  TOTP_REQUIRED: 401,
  TOTP_INVALID: 401,
  ACCOUNT_INACTIVE: 403,
  MEMBERSHIP_NOT_FOUND: 403,
  INVITE_INVALID: 400,
  INVITE_EXPIRED: 410,
  PASSWORD_COMPROMISED: 400,

  CREDIT_LIMIT_EXCEEDED: 422,
  INTENT_EXPIRED: 410,
  ALREADY_CONFIRMED: 409,
  IMPORT_ROW_ERRORS: 422,
  SELLER_INACTIVE: 403,

  INTENT_NOT_PENDING: 409,
  ROW_ALREADY_MATCHED: 409,
  POS_NOT_CONFIGURED: 422,
  POS_SIGNATURE_INVALID: 400,
};

export interface AppErrorDetails {
  readonly [key: string]: unknown;
}

/** Uygulama genelinde firlatilan tek hata tipi. API tarafinda exception filter yakalar. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: AppErrorDetails;

  constructor(code: ErrorCode, message?: string, details?: AppErrorDetails) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    this.status = HTTP_STATUS_BY_ERROR_CODE[code];
    this.details = details;
  }
}
