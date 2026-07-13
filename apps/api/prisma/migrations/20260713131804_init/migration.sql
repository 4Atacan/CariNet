-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('SALES_INVOICE', 'PAYMENT', 'TRANSFER_RECEIPT', 'REFUND', 'OPENING_BALANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "SellerMemberRole" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "IntentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CollectChannel" AS ENUM ('BANK_TRANSFER', 'CARD_POS');

-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('EXCEL_GENERIC', 'PRESET_LOGO', 'PRESET_MIKRO', 'PRESET_NETSIS', 'PRESET_ETA', 'UBL_XML', 'WIZARD', 'BANK_STATEMENT');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PARSED', 'COMMITTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'VALID', 'ERROR', 'COMMITTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_INVOICE', 'DUE_REMINDER', 'COLLECTION_CONFIRMED', 'CAMPAIGN', 'SYSTEM');

-- CreateTable
CREATE TABLE "sellers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "full_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "totp_secret" TEXT,
    "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_members" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "role" "SellerMemberRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_accounts" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "vkn_tckn" TEXT,
    "credit_limit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "representative_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyer_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_code_history" (
    "id" TEXT NOT NULL,
    "buyer_account_id" TEXT NOT NULL,
    "old_code" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_code_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "buyer_account_id" TEXT NOT NULL,
    "invited_by" TEXT,
    "last_active_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "buyer_account_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "representatives" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,

    CONSTRAINT "representatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "buyer_account_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "document_no" TEXT,
    "document_date" DATE NOT NULL,
    "due_date" DATE,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL DEFAULT 'TRY',
    "exchange_rate" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "description" TEXT,
    "invoice_id" TEXT,
    "collect_intent_id" TEXT,
    "import_batch_id" TEXT,
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "buyer_account_id" TEXT NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE,
    "currency_code" CHAR(3) NOT NULL DEFAULT 'TRY',
    "exchange_rate" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "net_total" DECIMAL(18,2) NOT NULL,
    "tax_total" DECIMAL(18,2) NOT NULL,
    "grand_total" DECIMAL(18,2) NOT NULL,
    "ubl_uuid" TEXT,
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ADET',
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(18,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL,
    "net_total" DECIMAL(18,2) NOT NULL,
    "tax_amount" DECIMAL(18,2) NOT NULL,
    "line_total" DECIMAL(18,2) NOT NULL,
    "exchange_rate" DECIMAL(18,4) NOT NULL DEFAULT 1,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ADET',
    "price" DECIMAL(18,2),
    "currency_code" CHAR(3) NOT NULL DEFAULT 'TRY',
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocks" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image_url" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "buyer_account_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "full_address" TEXT NOT NULL,
    "city" TEXT NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_bank_accounts" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "holder_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_pos_configs" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "api_key_enc" TEXT NOT NULL,
    "secret_enc" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_pos_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collect_intents" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "buyer_account_id" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL DEFAULT 'TRY',
    "channel" "CollectChannel" NOT NULL,
    "reference_code" TEXT NOT NULL,
    "installment_count" INTEGER,
    "provider_ref" TEXT,
    "status" "IntentStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collect_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_rows" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "import_id" TEXT NOT NULL,
    "row_no" INTEGER NOT NULL,
    "tx_date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT NOT NULL,
    "matched_intent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "source_type" "ImportSourceType" NOT NULL,
    "file_url" TEXT,
    "file_hash" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totals" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "row_no" INTEGER NOT NULL,
    "raw" JSONB NOT NULL,
    "parsed" JSONB,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "buyer_account_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "seller_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "membership_ctx" TEXT,
    "family_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by" TEXT,
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sellers_slug_key" ON "sellers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "seller_members_seller_id_idx" ON "seller_members"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_members_user_id_seller_id_key" ON "seller_members"("user_id", "seller_id");

-- CreateIndex
CREATE INDEX "buyer_accounts_seller_id_idx" ON "buyer_accounts"("seller_id");

-- CreateIndex
CREATE INDEX "buyer_accounts_seller_id_vkn_tckn_idx" ON "buyer_accounts"("seller_id", "vkn_tckn");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_accounts_seller_id_account_code_key" ON "buyer_accounts"("seller_id", "account_code");

-- CreateIndex
CREATE INDEX "account_code_history_buyer_account_id_idx" ON "account_code_history"("buyer_account_id");

-- CreateIndex
CREATE INDEX "account_code_history_old_code_idx" ON "account_code_history"("old_code");

-- CreateIndex
CREATE INDEX "account_memberships_buyer_account_id_idx" ON "account_memberships"("buyer_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_memberships_user_id_buyer_account_id_key" ON "account_memberships"("user_id", "buyer_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_hash_key" ON "invites"("token_hash");

-- CreateIndex
CREATE INDEX "invites_seller_id_idx" ON "invites"("seller_id");

-- CreateIndex
CREATE INDEX "invites_buyer_account_id_idx" ON "invites"("buyer_account_id");

-- CreateIndex
CREATE INDEX "representatives_seller_id_idx" ON "representatives"("seller_id");

-- CreateIndex
CREATE INDEX "transactions_seller_id_buyer_account_id_document_date_idx" ON "transactions"("seller_id", "buyer_account_id", "document_date");

-- CreateIndex
CREATE INDEX "transactions_seller_id_due_date_idx" ON "transactions"("seller_id", "due_date");

-- CreateIndex
CREATE INDEX "transactions_import_batch_id_idx" ON "transactions"("import_batch_id");

-- CreateIndex
CREATE INDEX "invoices_seller_id_buyer_account_id_idx" ON "invoices"("seller_id", "buyer_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_seller_id_invoice_no_key" ON "invoices"("seller_id", "invoice_no");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_items_invoice_id_line_no_key" ON "invoice_items"("invoice_id", "line_no");

-- CreateIndex
CREATE INDEX "products_seller_id_idx" ON "products"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_seller_id_code_key" ON "products"("seller_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "stocks_product_id_key" ON "stocks"("product_id");

-- CreateIndex
CREATE INDEX "stocks_seller_id_idx" ON "stocks"("seller_id");

-- CreateIndex
CREATE INDEX "campaigns_seller_id_starts_at_ends_at_idx" ON "campaigns"("seller_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "addresses_buyer_account_id_idx" ON "addresses"("buyer_account_id");

-- CreateIndex
CREATE INDEX "seller_bank_accounts_seller_id_idx" ON "seller_bank_accounts"("seller_id");

-- CreateIndex
CREATE INDEX "seller_pos_configs_seller_id_idx" ON "seller_pos_configs"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "collect_intents_reference_code_key" ON "collect_intents"("reference_code");

-- CreateIndex
CREATE INDEX "collect_intents_seller_id_status_idx" ON "collect_intents"("seller_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bank_statement_rows_matched_intent_id_key" ON "bank_statement_rows"("matched_intent_id");

-- CreateIndex
CREATE INDEX "bank_statement_rows_seller_id_import_id_idx" ON "bank_statement_rows"("seller_id", "import_id");

-- CreateIndex
CREATE INDEX "import_batches_seller_id_status_idx" ON "import_batches"("seller_id", "status");

-- CreateIndex
CREATE INDEX "import_batches_seller_id_file_hash_idx" ON "import_batches"("seller_id", "file_hash");

-- CreateIndex
CREATE UNIQUE INDEX "import_rows_batch_id_row_no_key" ON "import_rows"("batch_id", "row_no");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_date_currency_code_key" ON "exchange_rates"("date", "currency_code");

-- CreateIndex
CREATE INDEX "audit_logs_seller_id_created_at_idx" ON "audit_logs"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "seller_members" ADD CONSTRAINT "seller_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_members" ADD CONSTRAINT "seller_members_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_accounts" ADD CONSTRAINT "buyer_accounts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_accounts" ADD CONSTRAINT "buyer_accounts_representative_id_fkey" FOREIGN KEY ("representative_id") REFERENCES "representatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_code_history" ADD CONSTRAINT "account_code_history_buyer_account_id_fkey" FOREIGN KEY ("buyer_account_id") REFERENCES "buyer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_buyer_account_id_fkey" FOREIGN KEY ("buyer_account_id") REFERENCES "buyer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_buyer_account_id_fkey" FOREIGN KEY ("buyer_account_id") REFERENCES "buyer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representatives" ADD CONSTRAINT "representatives_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_buyer_account_id_fkey" FOREIGN KEY ("buyer_account_id") REFERENCES "buyer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_collect_intent_id_fkey" FOREIGN KEY ("collect_intent_id") REFERENCES "collect_intents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_buyer_account_id_fkey" FOREIGN KEY ("buyer_account_id") REFERENCES "buyer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_buyer_account_id_fkey" FOREIGN KEY ("buyer_account_id") REFERENCES "buyer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_bank_accounts" ADD CONSTRAINT "seller_bank_accounts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_pos_configs" ADD CONSTRAINT "seller_pos_configs_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collect_intents" ADD CONSTRAINT "collect_intents_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collect_intents" ADD CONSTRAINT "collect_intents_buyer_account_id_fkey" FOREIGN KEY ("buyer_account_id") REFERENCES "buyer_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_rows" ADD CONSTRAINT "bank_statement_rows_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_rows" ADD CONSTRAINT "bank_statement_rows_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_rows" ADD CONSTRAINT "bank_statement_rows_matched_intent_id_fkey" FOREIGN KEY ("matched_intent_id") REFERENCES "collect_intents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_buyer_account_id_fkey" FOREIGN KEY ("buyer_account_id") REFERENCES "buyer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
