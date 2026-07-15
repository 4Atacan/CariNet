-- Faz 5 §11.1 (2FA enrollment) + §11.6 (KVKK hesap silme / anonimlestirme)
-- users tablosuna kimlik-sertlestirme alanlari eklenir. Finansal veriye dokunulmaz.

ALTER TABLE "users" ADD COLUMN "totp_pending_secret" TEXT;
ALTER TABLE "users" ADD COLUMN "totp_enabled_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "backup_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN "anonymized_at" TIMESTAMP(3);
