-- §6.4 — ekstre basim indeksi.
--
-- Ekstrenin yuruyen bakiyesi, sayfadan ONCEKI tum hareketlerin toplamini ister (devir disarida
-- kalmasin diye tarih filtresi SONRA uygulanir, §6.4). Bu toplam carinin TUM gecmisini okur; yani
-- maliyet cari gecmisiyle dogrusal buyur ve heap'e dokunursa satir genisligine de baglanir.
--
-- INCLUDE ile toplamin ihtiyaci olan 3 kolon (type, amount, exchange_rate) indekse tasinir →
-- "Index Only Scan / Heap Fetches: 0". Sonuc: transactions satiri ilerde ne kadar genislerse
-- genislesin (fatura goruntusu eklentileri vb.) ekstre hizi ETKILENMEZ.
--
-- Kismi indeks (WHERE is_cancelled = FALSE): iptaller bakiyeye girmez (kural #4 — silinmez,
-- isaretlenir), indeks de onlari tasimaz.
--
-- Ham SQL, cunku Prisma INCLUDE ve kismi indeksi schema.prisma'da ifade edemez.
-- schema.prisma'daki karsilik: `/// @db-only` notu (bkz. Transaction modeli).
CREATE INDEX "transactions_ledger_covering_idx"
  ON "transactions" ("seller_id", "buyer_account_id", "document_date", "id")
  INCLUDE ("type", "amount", "exchange_rate")
  WHERE "is_cancelled" = FALSE;
