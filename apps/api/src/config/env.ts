import { z } from 'zod';

/** Kural #7: env degiskenleri de bir dis sinirdir → Zod. Eksik/yanlissa uygulama ACILMAZ. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET en az 32 karakter olmali'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET en az 32 karakter olmali'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  /** seller_pos_configs AES-256-GCM anahtari — 32 byte hex (64 karakter). */
  MASTER_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'MASTER_ENCRYPTION_KEY 64 karakterlik hex olmali')
    .optional(),

  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  MAIL_FROM: z.string().default('no-reply@carinet.local'),
  RESEND_API_KEY: z.string().optional(),

  TURNSTILE_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),

  /** §11.2 — prod'da Swagger /docs basic auth kimligi. Ikisi de bossa /docs prod'da HIC acilmaz. */
  SWAGGER_USER: z.string().optional(),
  SWAGGER_PASSWORD: z.string().optional(),

  PANEL_ORIGIN: z.string().default('http://localhost:3000'),
  /** POS callback URL'i saglayiciya bu adresle verilir (§8). */
  API_PUBLIC_URL: z.string().default('http://localhost:3001'),

  /** Sandbox POS'un hosted 3D sayfasi — BIZIM alan adimiz DEGIL (kural #5). */
  POS_SANDBOX_HOSTED_URL: z.string().url().default('https://sandbox-pos.example.com/hosted-3d'),
  /** §11.3 — mumkunse callback IP allowlist'i. Bos ise IP kontrolu yapilmaz. */
  POS_CALLBACK_IPS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Ortam degiskenleri gecersiz:\n${issues}`);
  }
  return parsed.data;
}
