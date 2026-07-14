/*
  Warnings:

  - Added the required column `target` to the `import_batches` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ImportTarget" AS ENUM ('BUYER_ACCOUNTS', 'TRANSACTIONS', 'OPENING_BALANCES', 'INVOICES', 'BANK_STATEMENT');

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "mapping" JSONB,
ADD COLUMN     "target" "ImportTarget" NOT NULL;

-- CreateTable
CREATE TABLE "import_templates" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_type" "ImportSourceType" NOT NULL,
    "target" "ImportTarget" NOT NULL,
    "mapping" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_templates_seller_id_idx" ON "import_templates"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "import_templates_seller_id_name_key" ON "import_templates"("seller_id", "name");

-- AddForeignKey
ALTER TABLE "import_templates" ADD CONSTRAINT "import_templates_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
