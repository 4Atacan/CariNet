-- Satici yoneticisi daveti: ayni tablo iki tur daveti tasir.
-- Sebep: prod'da yeni SELLER_ADMIN kendi basina giris yapamiyordu — kural #11 2FA'siz girisi
-- engelliyor, ama 2FA kurulum ucu giris yapmis olmayi istiyor. Davet akisi bu kilidi acar.

ALTER TABLE "invites" ALTER COLUMN "buyer_account_id" DROP NOT NULL;
ALTER TABLE "invites" ADD COLUMN "role" "SellerMemberRole";
ALTER TABLE "invites" ADD COLUMN "totp_pending_secret" TEXT;

-- Ikisinden TAM OLARAK biri dolu olmali. Prisma bunu ifade edemez; kural DB'de kalsin ki
-- ileride yanlis bir yazim sessizce gecmesin.
ALTER TABLE "invites" ADD CONSTRAINT "invites_target_exactly_one"
  CHECK (
    ("buyer_account_id" IS NOT NULL AND "role" IS NULL)
    OR
    ("buyer_account_id" IS NULL AND "role" IS NOT NULL)
  );
