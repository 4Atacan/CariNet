-- Referans kodunun (§7: S{sellerNo}-{accountCode}-{6 CSPRNG}) kisa satici numarasi.
-- Dis ID'ler cuid olarak kalir (§6.1); bu numara YALNIZ havale aciklamasina elle yazilan
-- referans kodunda kullanilir — kod kisa ve telefonda okunabilir olmak zorunda.
ALTER TABLE "sellers" ADD COLUMN "seller_no" SERIAL NOT NULL;

CREATE UNIQUE INDEX "sellers_seller_no_key" ON "sellers"("seller_no");
