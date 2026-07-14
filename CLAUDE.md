# CLAUDE.md — CariNet · B2B Cari Hesap Platformu (Ana Beyin)

> **Sürüm 3.2 · 14.07.2026 — Tek doğruluk kaynağı.** (3.2: Faz 3 kapandı → §7'ye `sellers.seller_no`, §10'a tahsilat uçları ve hata kodları eklendi. 3.1: §6.4 bakiye SQL'i dövizli satırlar için TRY normalizasyonuyla güncellendi.) Claude Code her oturumun başında bu dosyayı okur ve buradaki kurallara MUTLAK uyar. Kullanıcı talebi bu dosyayla çelişirse: önce çelişkiyi bildir, onaysız kural çiğneme. Kod tabanının haritası için dosyaları grep'leme — **Graphify grafiğini sorgula** (§5).

---

## 0. Kimlik ve Kapsam

Çok kiracılı (multi-tenant) B2B cari hesap platformu: **N satıcı firma × her satıcıda M alıcı firma.**

- **Satıcı firma** (web panel): cari hesaplarını yönetir, fatura/hareket girer (tekil + Excel + UBL), tahsilat onaylar, ürün/kampanya yayınlar.
- **Alıcı firma** (mobil): bakiye, ekstre, fatura detayı, risk föyü görür; iki kanaldan ödeme yapar.
- **Platform admin**: satıcı onboarding, abonelik, sistem izleme.
- **ERP entegrasyonu YOK** — panel + geçiş sihirbazı verinin tek kaynağıdır (§9). Mimari ileriye kapı bırakır ama v1'de kesinlikle yoktur.
- UI metinleri **Türkçe**; kod, tanımlayıcılar, commitler **İngilizce**. Varsayılan para birimi TRY, döviz alanları desteklenir.
- Aynı kullanıcı birden çok satıcının carisine üye olabilir, hatta hem satıcı personeli hem başka yerin alıcısı olabilir (§6.2).

---

## 1. Değişmez Kurallar (NON-NEGOTIABLE — 12 madde)

1. **Para asla float değildir.** Parasal alanlar `DECIMAL(18,2)`, kurlar `DECIMAL(18,4)`; TS tarafında decimal.js. `number` ile parasal aritmetik yasak.
2. **Bakiye türetilir, saklanmaz.** `Bakiye = Σ(DEBIT) − Σ(CREDIT)`. Yürüyen bakiye window function ile sorgu anında. `balance` kolonu yasak; önbellek gerekirse önce onay.
3. **Tenant izolasyonu mutlaktır.** Tenant tablolarında `seller_id` zorunlu; repository katmanı filtresiz sorgu çalıştıramaz; **her modülde cross-tenant erişim testi** (2 satıcılı seed ile) zorunlu.
4. **Finansal kayıt silinmez.** Düzeltme = ters kayıt veya `is_cancelled` + `audit_logs`. Hard delete yalnız finansal olmayan veride.
5. **Kart verisi sistemimize asla girmez ve platform para akışına aracılık etmez.** Kartlı tahsilat YALNIZCA satıcının kendi sanal POS/PSP hesabı üzerinden, sağlayıcının **hosted 3D sayfasıyla** yapılır (§8). Kart formu barındırmak, PAN/CVV işlemek/loglamak, platform hesabında para toplamak (facilitator) yasaktır. Platform komisyon ödemez ve almaz.
6. **TypeScript strict her pakette.** `any` yasak (kaçınılmazsa `// TODO(any):`).
7. **Zod her dış sınırda:** API body/query, Excel/ekstre import satırları, UBL ayrıştırma çıktısı, POS callback'leri, env değişkenleri.
8. **Ücretli servis eklenmez (onaysız).** Her şey ücretsiz/açık kaynak veya ücretsiz katman. (Satıcının kendi POS komisyonu platform maliyeti değildir; AI kolon eşleyici gibi ücretli çağrılar varsayılan KAPALI, onayla açılır.)
9. **Token saklama:** mobil `expo-secure-store`; panel httpOnly+Secure+SameSite cookie. `localStorage` yasak.
10. **Sır yönetimi:** koda yazılmaz, loglanmaz; `.env` + Coolify secrets; gitleaks pre-commit+CI. POS anahtarları DB'de AES-256-GCM şifreli.
11. **2FA (TOTP):** SELLER_ADMIN ve PLATFORM_ADMIN prod'da 2FA'sız çalışamaz.
12. **Prod erişimi:** DB ve Coolify paneli yalnız SSH tüneli/allowlist; DB portu internete kapalı.

---

## 2. Teknoloji Yığını (tamamı ücretsiz; sürümler bilinen-iyi alt sınır, kurulumda en güncel kararlıyı kullan)

| Katman                            | Seçimler                                                                                                                                                                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Temel                             | TypeScript strict · Node ≥22 LTS · pnpm ≥9 · Turborepo · Zod (`packages/shared`) · decimal.js                                                                                                                                                                    |
| Mobil `apps/mobile`               | Expo (güncel SDK) + Expo Router · TanStack Query v5 · Zustand (yalnız oturum/aktif hesap) · react-hook-form+zod · react-native-gifted-charts · expo-secure-store · expo-notifications · NativeWind                                                               |
| Panel `apps/panel`                | Next.js (App Router) · Tailwind v4 + shadcn/ui · TanStack Table v8 (sunucu sayfalama) · Recharts · TanStack Query · react-hook-form+zod · exceljs                                                                                                                |
| API `apps/api`                    | NestJS ≥11 · Prisma ≥6 (raporlarda `$queryRaw` serbest) · PostgreSQL ≥16 · Passport-JWT + argon2id · otplib (TOTP) · @nestjs/swagger `/docs` · @nestjs/throttler · @nestjs/schedule · pdfmake · fast-xml-parser (UBL) · pino (redaction'lı) · Vitest + Supertest |
| Lokal                             | Docker Compose: postgres:16-alpine + Mailpit + MinIO · ESLint+Prettier (sıfır uyarı) · husky+lint-staged+gitleaks · Playwright                                                                                                                                   |
| Üretim (~€5/ay tek ücretli kalem) | Hetzner VPS + Docker + Coolify · Cloudflare DNS proxy + WAF + Pages + R2 + Turnstile · Resend (3k/ay) · Sentry · UptimeRobot · GitHub Actions · EAS ücretsiz kota / lokal build · TCMB resmî kur servisi                                                         |
| AI araç zinciri                   | Claude Code · **Graphify** (kod bilgi grafiği, §5) · Obsidian (graf görselleştirme)                                                                                                                                                                              |

---

## 3. Depo Yapısı

```
.
├── CLAUDE.md                  ← bu dosya (beyin — tek doğruluk kaynağı)
├── PROGRESS.md                ← AI çalışma günlüğü (§16)
├── .graphifyignore            ← grafik kapsamı (§5)
├── docker-compose.yml         ← postgres + mailpit + minio
├── turbo.json  ·  pnpm-workspace.yaml
├── .github/workflows/ci.yml   ← lint+typecheck+test+build+gitleaks
├── apps/
│   ├── api/src/modules/       ← auth · sellers · buyers · transactions · invoices
│   │                            reports · collections · imports · products
│   │                            campaigns · notifications · exchange-rates · audit
│   ├── panel/                 ← Next.js (satıcı)
│   └── mobile/                ← Expo (alıcı)
├── packages/
│   ├── shared/                ← Zod şemaları, tipler, enumlar, errors.ts, para yardımcıları
│   └── config/                ← eslint/ts/prettier ortak
└── docs/graph/                ← Graphify çıktısı (graph.json + Obsidian notları) — commit'lenir
```

Her API modülü: `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `dto/`, `*.spec.ts` (tenant testi dahil).

---

## 4. Ortam ve Komutlar

**Önkoşullar:** Node ≥22, pnpm ≥9, Docker, uv (Graphify).

```
# .env.example
DATABASE_URL=
JWT_ACCESS_SECRET=  JWT_REFRESH_SECRET=
JWT_ACCESS_TTL=15m  JWT_REFRESH_TTL=30d
MASTER_ENCRYPTION_KEY=            # seller_pos_configs AES anahtarı
S3_ENDPOINT= S3_BUCKET= S3_ACCESS_KEY= S3_SECRET_KEY=   # lokal MinIO / prod R2
SMTP_HOST= SMTP_PORT=             # lokal Mailpit
RESEND_API_KEY=  TURNSTILE_SECRET=  SENTRY_DSN=
EXPO_PUBLIC_API_URL=  NEXT_PUBLIC_API_URL=
```

| Komut                                        | İş                                 |
| -------------------------------------------- | ---------------------------------- |
| `docker compose up -d`                       | postgres + mailpit + minio         |
| `pnpm dev`                                   | üç uygulama (turbo)                |
| `pnpm --filter api db:migrate` / `db:seed`   | migrate / tohum                    |
| `pnpm test` · `pnpm lint` · `pnpm typecheck` | kalite kapıları                    |
| `graphify . --update --no-label --code-only` | kod grafiğini tazele (0 token, §5) |

**Seed (değişmez):** **2 satıcı** (izolasyon testinin ön koşulu) · satıcı-1: admin + 3 cari (biri çoklu-üyelikli; kullanıcısı satıcı-2'de de cari) · 60+ hareket (farklı vadeler, 1 dövizli fatura, **1 DEVİR kaydı**) · 1 bekleyen collect_intent + örnek banka ekstresi CSV'si · satıcı-2: sandbox POS configli · 2 ürün, 1 kampanya.

---

## 5. Graphify + Obsidian Entegrasyonu (token tasarrufu katmanı — SİSTEMİN PARÇASI)

Amaç: Claude Code repoyu her oturumda yeniden okumak yerine hazır bilgi grafiğini sorgular. Varsayılan (AST) mod LLM çağrısı yapmaz → **0 token**.

**Kurulum (Faz 0 görevi, bir kez):**

```bash
uv tool install "graphifyy==0.9.14"    # paket çift y, komut tek y · sürüm SABİT (§5 uyarısı)
graphify install --platform claude     # ~/.claude/skills/graphify/SKILL.md
graphify hook install                  # her commit'te AST-only artımlı güncelleme
graphify . --obsidian --obsidian-dir ./docs/graph   # ilk grafik + Obsidian vault
```

> Tek kurulum olmalı: `pip install graphifyy` ile ikinci bir kopya varsa PATH'te onu gölgeler ve eski sürüm yeni grafiği okuyamaz (`KeyError: 'hash'`). `which graphify` → `~/.local/bin/graphify` (uv) olmalı.

**.graphifyignore (repo kökü):** `node_modules/`, `dist/`, `build/`, `.next/`, `.expo/`, `coverage/`, `*.lock`, görseller **ve `.husky/_/`**.

> ⚠️ **`.husky/_/` satırı zorunludur.** Husky o klasöre içeriği tek satır `*` olan bir `.gitignore` yazar. Graphify iç içe ignore dosyalarını tararken bu deseni yükleyip **tüm repoya** uygular (0.9.15 hatası) → grafik sessizce boşalır (2071 → 0 dosya). Klasörü baştan budayınca desen hiç okunmaz. Sürüm sabiti: **graphify 0.9.14** (0.9.15 bu yüzden kullanılmaz).

**Kullanım kuralları (komutlar birebir böyle — yanlışı LLM anahtarı ister, kural #8):**

- "X'i kim çağırıyor / neye bağlı / nerede tanımlı?" → **`graphify explain "matchStatementRows"`** (çağıran/çağrılan + dosya + satır). Grep son çare.
- İki modül arasındaki bağ: **`graphify path "collections.controller.ts" "ledger.repository.ts"`**.
- `graphify query` doğal dil aramasıdır ve **semantik indeks (LLM) ister** → AST modunda "No matching nodes found" döner; bu normaldir.
- Grafiği tazele: **`graphify . --update --no-label --code-only`** → yerel AST, **0 token**. (`--code-only` olmadan markdown dosyaları için LLM anahtarı ister; `--no-label` topluluk isimlendirmesini atlar.) Rapor/HTML için ardından `graphify cluster-only . --no-label`.
- `--mode deep` (LLM'li semantik kenar) ücretli çağrıdır → kural #8: yalnız kullanıcı onayıyla.
- Grafik çıktıları (`graphify-out/`) commit'lenir; merge çakışmasını hook'un kurduğu merge driver çözer.
- Post-commit hook her commit'te artımlı AST güncellemesi yapar (LLM yok).

---

## 6. Mimari Kararlar

### 6.1 Multi-tenancy

Paylaşımlı şema + `seller_id`. JWT bağlamı → global `TenantGuard` → repository zorunlu filtresi (üçlü hat). Opsiyonel son kemer: PostgreSQL RLS (`current_setting('app.seller_id')`). Dış ID'ler cuid — artan sayı sızdırma. Rate limit tenant bazında da uygulanır; import işleri kuyrukta sıralı.

### 6.2 Kimlik: küresel kullanıcı + üyelikler (KRİTİK — 1-1 kurma!)

- `users` (e-posta/telefon UNIQUE) kimliği taşır; yetki üyeliklerden gelir:
  `account_memberships (user_id, buyer_account_id)` → alıcı tarafı · `seller_members (user_id, seller_id, role)` → satıcı tarafı. Aynı kullanıcı ikisinde de olabilir (çift rol).
- `account_code` yalnız satıcı içinde benzersizdir → cari koduyla giriş ancak satıcı bağlamıyla: birincil yol **davet linki/QR** (`/j/{sellerSlug}/{token}`) ile aktivasyon; sonrası küresel kimlikle giriş; yedek: girişte satıcı kodu alanı.
- **Hesap değiştirici:** üyelik listesi → seçim → `POST /v1/auth/switch-account` → yeni access+refresh çifti. Push token kullanıcı+cihaz bazlı; bildirim payload'ı `sellerId+buyerAccountId` taşır, rozetler hesap bazlı.
- Üyelik kaldırılınca o bağlamın refresh token ailesi iptal. Kullanıcı hesap silerse kimlik anonimleştirilir, finansal kayıtlar satıcı defterinde kalır (yasal saklama).
- Satıcı pasifleşirse alıcılar salt-okunur görür + bilgilendirme bandı; tahsilat kapanır.

### 6.3 JWT

```json
{
  "sub": "userId",
  "mem": "membershipId",
  "role": "BUYER_USER|SELLER_ADMIN|SELLER_STAFF|PLATFORM_ADMIN",
  "sellerId": "...",
  "buyerAccountId": "alıcı rolünde"
}
```

Access ≈15 dk; refresh ≈30 gün rotasyonlu + **reuse tespiti** → aile toptan iptal + bildirim.

### 6.4 Bakiye / yürüyen bakiye (kural #2'nin SQL'i)

**Bakiye TRY cinsindendir.** `transactions.amount` belgenin KENDİ para biriminde tutulur (`currency_code`), kur kayıt anında satıra sabitlenir (`exchange_rate`, §7) → bakiye/ekstre daima TRY karşılığı üzerinden hesaplanır: `ROUND(amount × exchange_rate, 2)`. Yuvarlama **satır bazında** yapılır (kural #1, kuruş farkı oluşmaz). TRY satırlarda kur 1'dir, yani ifade ham `amount` toplamına indirgenir.

```sql
SELECT t.*,
       ROUND(t.amount * t.exchange_rate, 2) AS amount_try,
       SUM((CASE WHEN t.type='DEBIT' THEN 1 ELSE -1 END) * ROUND(t.amount * t.exchange_rate, 2))
         OVER (PARTITION BY t.buyer_account_id ORDER BY t.document_date, t.id) AS running_balance
FROM transactions t
WHERE t.seller_id = $1 AND t.buyer_account_id = $2 AND t.is_cancelled = FALSE;
```

Yürüyen bakiye TÜM tarihçe üzerinden hesaplanır, tarih filtresi SONRA uygulanır (devir dışarıda kalmasın). Tek uygulama noktası: `apps/api/src/modules/ledger/`. `$queryRaw` tenant eklentisinin dışındadır → `seller_id` her ham sorguda elle konur (kural #3).

Ortalama vade = tutar ağırlıklı. Risk föyü yaşlandırma kovaları: 0-30 / 31-60 / 61-90 / 90+ gün.

### 6.5 Tahsilat soyutlaması

```ts
interface CollectionProvider {
  createIntent(i: CollectIntentInput): Promise<CollectIntent>;
  reconcile(evidence: ReconcileInput): Promise<CollectionResult>; // idempotent!
}
```

Uygulamalar: `BankTransferProvider` (Kanal 1) + satıcı-POS adaptörleri (Kanal 2, hosted 3D). İki kanal onayda AYNI hatta birleşir: `CONFIRMED` → otomatik `CREDIT` → push → audit.

### 6.6 Import hattı

yükle → ayrıştır (exceljs / fast-xml-parser) → satır satır Zod → staging (`import_rows`) → önizleme + hata raporu (satır no + sebep) → onay → **tek DB transaction** commit → özet. Dosya R2/MinIO'ya arşivlenir; hash ile mükerrer uyarısı; batch iptali = bağlı kayıtlara toplu `is_cancelled` + audit.

---

## 7. Veri Modeli

### Enumlar (`packages/shared`)

```ts
TransactionType = 'DEBIT' | 'CREDIT';
DocumentType =
  'SALES_INVOICE' | 'PAYMENT' | 'TRANSFER_RECEIPT' | 'REFUND' | 'OPENING_BALANCE' | 'OTHER';
UserRole = 'PLATFORM_ADMIN' | 'SELLER_ADMIN' | 'SELLER_STAFF' | 'BUYER_USER';
IntentStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
CollectChannel = 'BANK_TRANSFER' | 'CARD_POS';
```

### Tablolar (Prisma şemasının kaynağı)

| Tablo                        | Kritik alanlar                                                                                                                                                                                | Not                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `sellers`                    | name, slug UNIQUE, **seller_no SERIAL UNIQUE**, logo_url, is_active                                                                                                                           | Tenant kökü; slug misafir ödeme URL'inde. `seller_no` YALNIZ referans kodundadır (dış ID'ler cuid — §6.1) |
| `users`                      | email? UNIQUE, phone? UNIQUE, password_hash, totp_secret?, is_active                                                                                                                          | Küresel kimlik (§6.2)                                                                                     |
| `seller_members`             | user_id, seller_id, role(ADMIN/STAFF)                                                                                                                                                         | Satıcı personeli                                                                                          |
| `buyer_accounts`             | seller_id, account_code, title, vkn_tckn?, credit_limit, representative_id                                                                                                                    | (seller_id, account_code) UNIQUE; VKN → UBL eşleşme + tekilleştirme                                       |
| `account_code_history`       | buyer_account_id, old_code, changed_at                                                                                                                                                        | Havale açıklamaları eski kodla gelebilir                                                                  |
| `account_memberships`        | user_id, buyer_account_id, invited_by, last_active_at                                                                                                                                         | Çoklu hesap köprüsü                                                                                       |
| `invites`                    | seller_id, buyer_account_id, token_hash, expires_at, used_at                                                                                                                                  | Davet/QR akışı                                                                                            |
| `representatives`            | seller_id, full_name, phone                                                                                                                                                                   |                                                                                                           |
| `transactions`               | seller_id, buyer_account_id, type, document_type, document_date, due_date, amount, currency_code, exchange_rate, description, invoice_id?, collect_intent_id?, import_batch_id?, is_cancelled | Sistemin kalbi (kural #2/#4)                                                                              |
| `invoices` + `invoice_items` | başlık toplamları / kalem: quantity, unit_price, tax_rate, net_total, exchange_rate                                                                                                           | (seller_id, invoice_no) UNIQUE; satır bazlı kur                                                           |
| `products` / `stocks`        | seller_id, code, name, unit, price?, quantity                                                                                                                                                 | Vitrin                                                                                                    |
| `campaigns`                  | seller_id, title, body, image_url, starts_at, ends_at                                                                                                                                         |                                                                                                           |
| `addresses`                  | buyer_account_id, label, full_address, city                                                                                                                                                   |                                                                                                           |
| `seller_bank_accounts`       | seller_id, bank_name, iban, holder_name, is_active                                                                                                                                            | IBAN değişikliği = kritik işlem (§11)                                                                     |
| `seller_pos_configs`         | seller_id, provider, merchant_id, api_key_enc, secret_enc, is_active                                                                                                                          | Satıcının KENDİ POS'u; AES-256-GCM şifreli                                                                |
| `collect_intents`            | seller_id, buyer_account_id?, amount, channel, reference_code UNIQUE, installment_count?, provider_ref?, status, expires_at, confirmed_by?, statement_row_id?                                 | Tahsilat kaydı (§8)                                                                                       |
| `bank_statement_rows`        | seller_id, import_id, row_no, tx_date, amount, description, matched_intent_id? UNIQUE                                                                                                         | Ekstre importu                                                                                            |
| `import_batches`             | seller_id, source_type(EXCEL_GENERIC/PRESET_*/UBL_XML/WIZARD), file_url, status, totals jsonb, created_by                                                                                     | Geçiş + rutin importlar (§9)                                                                              |
| `import_rows`                | batch_id, row_no, raw jsonb, parsed jsonb, status, error                                                                                                                                      | Staging + izlenebilirlik                                                                                  |
| `notifications`              | user_id, seller_id, buyer_account_id?, title, body, type, read_at                                                                                                                             | Hesap bazlı rozet                                                                                         |
| `exchange_rates`             | date, currency_code, rate                                                                                                                                                                     | TCMB cron                                                                                                 |
| `audit_logs`                 | actor_user_id, seller_id?, action, entity, entity_id, before/after jsonb                                                                                                                      | Finansal değişimde zorunlu                                                                                |
| `refresh_tokens`             | user_id, membership_ctx, family_id, token_hash, expires_at, revoked_at                                                                                                                        | Rotasyon + reuse                                                                                          |

**Sabitler:** para `DECIMAL(18,2)`, kur `DECIMAL(18,4)` · kur kayıt anında satıra sabitlenir · tenant tablolarında `(seller_id, …)` bileşik indeks; `transactions`: `(seller_id, buyer_account_id, document_date)` · referans kodu formatı `S{sellerNo}-{accountCode}-{6 CSPRNG}`.

---

## 8. Tahsilat Sistemi — İki Kanal (platform para akışına GİRMEZ)

Referans model (Dream/SDS) çözümlemesi: onların "Online Ödeme Merkezi" de lisanslı bir altyapının hosted sayfasıdır; satıcı kendi POS'unu gömer, kart verisi yazılıma girmez. Biz aynı deseni iki kanalla uygularız:

**Kanal 1 — Havale/EFT/FAST + Referans Eşleştirme (komisyon 0, varsayılan):**
Alıcı "Ödeme Yap" → tutar/fatura → `collect_intent` + referans kodu → ekran: satıcı IBAN'ı + kod (kopyala/paylaş) → `PENDING` (72 saatte `EXPIRED`). Panelde: manuel onay VEYA internet bankacılığı CSV/Excel ekstresi importu → otomatik eşleştirme önerisi → toplu onay. Kenar durumlar: kısmi tutar (gerçekleşen işlenir, fark yeni intent) · açıklamasız dekont (öneri + insan onayı) · iade (`REFUND` ters kayıt).

**Kanal 2 — Kart: satıcının KENDİ POS'u + hosted 3D sayfa:**
Satıcı kendi bankasının sanal POS'unu veya kendi PSP hesabını `seller_pos_configs` ile bağlar. Ödeme DAİMA sağlayıcının hosted sayfasında, 3D zorunlu → PCI yükü minimum (SAQ-A düzeyi). "Güncel Taksit Seçenekleri" tutar/BIN ile sağlayıcıdan çekilir. Callback: imza doğrulama + idempotency. Para doğrudan satıcının hesabına akar. Adaptörler talep geldikçe eklenir; ilki pilot satıcının sağlayıcısına göre yazılır.

**Ortak hat:** iki kanal da `CONFIRMED` → otomatik `CREDIT` → bakiye düşer → push → audit. Misafir sayfa `pay/{sellerSlug}`: havale her zaman; kart, satıcının aktif POS'u varsa (Turnstile + rate limit + var/yok sızdırmayan yanıt).

**Yasal çerçeve:** Kartı aracısız kabul etmek 6493 sayılı Kanun kapsamında TCMB lisansı gerektirir → platform hesabına para toplayan her model YASAK (kural #5). Yukarıdaki iki kanal lisans kapsamı dışındadır.

---

## 9. Veri Geçişi (Onboarding) — Birikmiş cari & fatura tarihçesi

**İlke: Kesim tarihi + Devir.** Tarihçenin tamamı taşınmaz; her carinin kesim günündeki bakiyesi tek `OPENING_BALANCE` hareketi olur (kural #2 bozulmaz). Seviyeler: Minimal (yalnız devir, ~15 dk) · **Standart ✅** (devir + son 3-6 ay detay) · Tam (nadiren).

**Kaynak matrisi:**

| Satıcının durumu                                         | Kanal                                                                                                          |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Muhasebe/ERP programı (Logo, Mikro, Netsis, ETA, Zirve…) | Excel export + hazır profil (PRESET_LOGO/MIKRO/NETSIS/ETA/GENERIC; onaylanan eşleme şablon olarak saklanır)    |
| e-Fatura/e-Arşiv mükellefi (çoğunluk)                    | Entegratör portalından **UBL-TR XML/ZIP** → otomatik fatura+kalem+DEBIT; cari eşleşmesi VKN ile — altın kaynak |
| Yalnız mali müşavir                                      | Müşavirden ekstre Excel'i veya bakiye listesi                                                                  |
| Kayıt sistemi yok                                        | Paneldeki Devir Sihirbazı ile elle giriş                                                                       |

**Sihirbaz akışı:** kesim tarihi → cari listesi yükle (VKN önerilir) → devir bakiyeleri VEYA ekstre yükle (devri sistem hesaplar) → (ops.) UBL ZIP → **Doğrulama Raporu** (program toplamı ↔ bizim hesap, cari bazlı fark listesi; fark kapanmadan/onaylanmadan go-live yok) → commit → davetler. Go-live sonrası alıcı ilk girişte "Devir bakiyeni onayla / itiraz et" mutabakat kartı görür (itiraz → talep-öneri).

**AI kolon eşleyici (opsiyonel, kural #8):** tanınmayan Excel'de yalnız başlık satırı + 3 örnek satır Claude API'ye → eşleme önerisi → insan onayı. Varsayılan KAPALI.

---

## 10. API Sözleşmesi

Taban `/v1` · REST+JSON · Swagger `/docs` (prod'da auth arkasında) her zaman güncel.

```json
{ "success": true,  "data": {}, "meta": { "page": 1, "limit": 20, "total": 154 } }
{ "success": false, "error": { "code": "TENANT_FORBIDDEN", "message": "Türkçe mesaj" } }
```

Hata kodları `packages/shared/errors.ts`: VALIDATION_ERROR · UNAUTHORIZED · TENANT_FORBIDDEN · NOT_FOUND · CREDIT_LIMIT_EXCEEDED · INTENT_EXPIRED · INTENT_NOT_PENDING · ALREADY_CONFIRMED · ROW_ALREADY_MATCHED · POS_NOT_CONFIGURED · POS_SIGNATURE_INVALID · IMPORT_ROW_ERRORS…
Sayfalama `?page=&limit=` (vars. 20, maks 100) + meta; ekstrede `?from=&to=`. Tarihler ISO 8601 UTC; arayüz Europe/Istanbul. State değiştiren uçlar idempotency gözetir; misafir uçlar Turnstile'lı.
Uç grupları: `/auth` (login, refresh, logout, forgot, switch-account, sessions, revoke-all) · `/buyers` · `/transactions` · `/invoices` · `/reports` (risk, periodic-balance, average-due, statement-pdf) · `/collections` (intents, intents/:id/confirm·cancel·pay, installments, guest/{sellerSlug}, statement-import → matches → confirm, pos-callback/{provider}) · `/sellers` (me, bank-accounts, pos-config, pos-providers) · `/imports` (wizard, ubl, presets) · `/products` · `/campaigns` · `/notifications` · `/exchange-rates` · `/audit`.

---

## 11. Güvenlik (8 katman — Faz 5'in release kapısı; "öneri" değil GEREKSİNİM)

**1 Kimlik/oturum:** argon2id · sızmış parola kontrolü (HIBP range, ücretsiz) · refresh rotasyonu + reuse→aile iptali · TOTP 2FA (kural #11) · cihaz listesi + uzaktan çıkış · login/reset/misafir uçlarında throttle + Turnstile + tek tip yanıt.
**2 Uygulama:** Zod her sınırda · DTO whitelist (mass assignment kapalı) · Prisma parametrik · TenantGuard+repo filtresi+test matrisi (IDOR imkânsız) · Helmet+sıkı CSP · CORS allowlist · panel CSRF token · upload: uzantı+MIME+magic-byte, Excel ≤10MB görsel ≤5MB, private bucket + imzalı URL · SSRF kapalı · hata yanıtı iç detay sızdırmaz.
**3 Tahsilat:** referans kodu CSPRNG · intent süreli · eşleştirme idempotent + DB unique çift-onay kilidi · ekstre importu saldırı yüzeyidir: Zod + CSV injection etkisizleştirme (hücre başı `'`) · POS anahtarları AES-256-GCM (master key env), panelde maskeli, değişiklik=2FA+audit · POS callback imza doğrulama + mümkünse IP allowlist; doğrulanamayan işlenmez+alarm · IBAN değişikliği=kritik işlem (2FA+audit).
**4 VPS:** UFW yalnız 80/443+SSH · SSH key-only, root kapalı, fail2ban/CrowdSec · unattended-upgrades · Docker non-root · DB yalnız iç ağ (kural #12) · Coolify: 2FA+allowlist/tünel.
**5 Ağ kenarı (Cloudflare ücretsiz):** proxy açık → origin IP gizli + origin yalnız CF IP'lerinden · WAF managed kurallar + login/misafir için ek rate kuralları · TLS Full(strict) + HSTS preload.
**6 Veri/sır:** gece yedeği age/gpg şifreli → R2 · **aylık restore provası** (kanıt PROGRESS.md) · gitleaks · pino redaction (parola/token/IBAN maskeli) · KVKK: aydınlatma, saklama politikası, veri minimizasyonu, hesap silme (anonimleştirme).
**7 Tedarik zinciri/CI:** Dependabot/Renovate + `pnpm audit` kapısı · lockfile zorunlu · Actions sürümleri pin'li · Trivy imaj taraması · ZAP baseline (staging).
**8 İzleme/olay:** Sentry ×3 · UptimeRobot · audit: başarısız girişler, IBAN/POS değişikliği, toplu import, yetki değişimi · alarm: 5 dk'da X başarısız login; anormal misafir denemesi→geçici ban · yazılı olay planı: revoke-all ucu, anahtar rotasyonu, yedekten dönüş, kullanıcı bilgilendirme şablonu.

---

## 12. Kodlama Standartları

DB snake_case · TS camelCase · bileşen PascalCase · dosya kebab-case. Sözlük: cari hesap→buyerAccount · borç→DEBIT · alacak→CREDIT · vade→dueDate · ekstre→statement · cari kodu→accountCode · tahsilat→collection · devir→openingBalance.
Conventional Commits (`feat(api): …`, `docs: …`) · `main` + `feature/*` · UI metinleri `tr.ts` sözlüklerinde · yorum yalnız "neden"i anlatır · YAGNI.
**Test zorunluluğu:** para hesabına unit test · her modüle cross-tenant testi · auth+collections+imports'a e2e · CI yeşil olmadan merge yok.

---

## 13. Geliştirme Fazları (sıralı; "bitti kriteri" sağlanmadan faz kapanmaz)

### Faz 0 — İskelet ve Temel (1–2 hafta)

- [ ] Turborepo+pnpm iskeleti · docker-compose · `.env.example`
- [ ] Prisma şeması (§7) + ilk migration + **2 satıcılı seed**
- [ ] Auth: login, refresh rotasyonu+reuse tespiti, logout, şifre sıfırlama (Mailpit) · davet iskeleti · switch-account
- [ ] TenantGuard + roller + cross-tenant test matrisi
- [ ] Yanıt zarfı interceptor + exception filter + Swagger
- [ ] CI: lint+typecheck+test+build+gitleaks
- [ ] **Graphify kurulumu (§5): skill + hook + ilk grafik + docs/graph vault**
- [ ] Mobil ve panelde login çalışır
      **✅ Bitti:** iki satıcının kullanıcılarıyla giriş; A→B verisine erişemiyor (test kanıtlı); Graphify commit'te otomatik güncelleniyor.

### Faz 1 — Çekirdek MVP (5–7 hafta)

**Panel:** cari CRUD+temsilci+limit · hareket girişi · fatura+kalem · **Excel import** (şablon→hata raporu→onay) · **GEÇİŞ SİHİRBAZI** (kesim tarihi→cari+devir→ops. UBL ZIP→Doğrulama Raporu→commit, §9) · davet linki/QR · kullanıcı yönetimi · listede canlı bakiye
**Mobil:** giriş+beni hatırla+**hesap değiştirici** · Dashboard (cari kodu, bakiye, limit, temsilci, borç/alacak pastası, son 10 hareket) · Ekstre (tarih filtre+yürüyen bakiye+sonsuz kaydırma) · Fatura Detayı (kalem+satır kuru)
**✅ Bitti:** 200 satırlık Excel hatasız ✅; bakiye=Σhareket (test) ✅; çoklu-üyelik geçişi çalışıyor ✅; **pilotun gerçek verisi sihirbazla sıfır farkla taşındı** ⏳ (gerçek veri bekliyor); pilot satıcıya gösterilebilir ⏳.

> Kod tarafı 14.07.2026'da tamamlandı (PROGRESS.md). Kalan iki madde pilot verisi gerektirir.

### Faz 2 — Finansal Raporlar (2–3 hafta) — ✅ TAMAMLANDI (14.07.2026)

- [x] Risk Föyü (açık bakiye, vadesi geçen, yaşlandırma 0-30/31-60/61-90/90+, limit %) — tahsilat FIFO ile en eski borçtan düşülür
- [x] Dönemsel Bakiye (raw SQL+grafik) · Ortalama Vade (ağırlıklı util+test) · Adresler · Ekstre PDF (pdfmake)+paylaş · panel özet raporu
      **✅ Bitti:** rapor rakamları elle hesaplananlara eşit (`reports.e2e-spec.ts` — kontrollü cari, beklenen değerler testte elle yazılı).

### Faz 3 — Tahsilat: İki Kanal (3–4 hafta) → §8 — ✅ TAMAMLANDI (14.07.2026)

- [x] `CollectionProvider` + `BankTransferProvider` · intent yaşam döngüsü + expiry cron (72 saat)
- [x] Mobil "Ödeme Yap" (referans+IBAN, kopyala/paylaş) · Panel: bekleyen intent + manuel onay + **ekstre importu→eşleştirme→toplu onay**
- [x] Kısmi (fark→yeni intent) / açıklamasız (insan onayı) / reddedilen ödeme senaryoları
- [x] `seller_pos_configs` CRUD (AES, 2FA'lı değişiklik) · sandbox POS adaptörü hosted 3D + callback imza+idempotency · Taksit Seçenekleri ekranı
- [x] Ortak hat: CONFIRMED→CREDIT+bildirim+audit · misafir `pay/{sellerSlug}` kanal seçimli
      **✅ Bitti:** (1) sahte ekstreyle havale akışı uçtan uca ✅; (2) sandbox POS: hosted 3D paketi→imzalı callback→bakiye düşer ✅; (3) aynı intent/satır/callback ikinci kez işlenemiyor ✅ — üçü de `collections.e2e-spec.ts` ile kanıtlı (23 test).

> **Karta çekilen ≠ cariden düşülen:** taksit vade farkı bankanındır; borç yalnız intent tutarı kadar düşer.
> **Push gönderimi Faz 4'te:** ortak hat bildirimi `notifications` tablosuna yazar; cihaza push Faz 4.
> **Pilotun POS sağlayıcısı belli olunca** ikinci adaptör yazılır (§8: "adaptörler talep geldikçe eklenir").

### Faz 4 — Katalog ve İletişim (3–4 hafta)

- [ ] Ürünler+Stoklar (panel CRUD+mobil vitrin) · Kampanyalar+push duyuru
- [ ] Push altyapısı: yeni fatura, vade hatırlatma (cron), tahsilat onayı — payload hesap bağlamlı
- [ ] Bildirim merkezi (hesap bazlı rozet) · Talep-Öneri · TCMB kur cronu+Kurlar ekranı · Excel dışa aktarma (CSV injection korumalı)
      **✅ Bitti:** vadesi yaklaşan seed faturası cron bildirimi üretiyor; kampanya push'u test cihazına hesap bağlamıyla ulaşıyor.

### Faz 5 — Sertleştirme ve Yayın (2 hafta)

- [ ] §11'in TÜM maddeleri işaretli (release kapısı) · 2FA zorunlu · revoke-all ucu
- [ ] VPS+Cloudflare sertleştirme · şifreli yedek→R2 + **restore provası**
- [ ] Trivy+ZAP CI'da · Sentry ×3 · hesap silme akışı (Apple) · KVKK sayfaları
- [ ] Coolify prod deploy · Pages'e panel · mağaza paketleri + demo hesap · yük hedefi: 100 eşzamanlı ekstre <500ms
      **✅ Bitti:** güvenlik listesi %100 · restore bir kez kanıtlı · uygulama mağaza incelemesinde · prod izleniyor.

---

## 14. Yapılmayacaklar (açık yasaklar)

❌ Parada float/number · ❌ `balance` kolonu · ❌ `seller_id` filtresiz sorgu · ❌ finansal kayıtta hard delete · ❌ kart verisi işlemek/loglamak/formunu barındırmak · ❌ platform hesabında para toplamak (facilitator) · ❌ onaysız ücretli servis (AI eşleyici ve `--mode deep` dahil) · ❌ ERP gerçek-zaman entegrasyonuna başlamak (v1 dışı; kapı §9'daki import uçları) · ❌ `localStorage`'da token · ❌ Swagger güncellenmeden endpoint değişikliği · ❌ kullanılmayan soyutlama (YAGNI) · ❌ testi geçirmek için testi zayıflatmak · ❌ kullanıcı↔cari ilişkisini 1-1 kurmak (§6.2).

---

## 15. Definition of Done (her görev)

1. `pnpm lint && pnpm typecheck && pnpm test` yeşil. 2. Etkilenen modülde tenant testi var. 3. Sınırlarda Zod; Swagger güncel. 4. UI metinleri Türkçe + sözlükte. 5. Parasal mantık decimal.js + unit test. 6. PROGRESS.md güncellendi. 7. Kod ilişkileri değiştiyse `graphify . --update` çalıştırıldı.

---

## 16. AI Çalışma Protokolü (Claude Code)

1. **Oturum açılışı sırası:** bu dosya → `PROGRESS.md` (aktif faz + son kararlar) → aktif faz bölümü → gerekiyorsa Graphify grafiği. Fazla bölüm yükleme; kod haritası sorularında grep yerine grafiği sorgula (§5).
2. Büyük işten önce 3-5 satırlık plan (dokunulacak dosyalar + yaklaşım), sonra uygulama.
3. Her çalışma bloğu sonunda `PROGRESS.md`'ye şablonla kayıt: tarih · yapılan · karar · **VARSAYIM:** (varsa) · sonraki adım. Bu dosya oturumlar arası hafızadır.
4. Karar önceliği: §1 kuralları > kullanıcının güncel talimatı > bu protokol > kendi varsayımın. Çelişkide dur ve bildir.
5. Fazlar sıralı; bitti kriteri sağlanmadan geçiş yok. Kapsam dışı istek → ilgili faza Backlog notu + kullanıcıya bilgi.
6. Bu dosyada bir bölümü değiştirdiysen commit'te `docs:` öneki kullan ve sürüm satırını güncelle.

> **Kuzey yıldızı:** Alıcı bakiyesini 3 saniyede görmeli; satıcı ayın faturalarını 3 dakikada, yılların devrini bir öğleden sonra içeri alabilmeli; tek bir kuruş yanlış hesaplanmamalı, tek bir kayıt yanlış tenant'a sızmamalı.
