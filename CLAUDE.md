# CLAUDE.md — CariNet · B2B Cari Hesap Platformu (Ana Beyin)

> **Sürüm 4.5 · 20.07.2026 — Tek doğruluk kaynağı.** (4.5: **Sentry API+panel canlı ve doğrulandı** [AB bölgesi; API çalışma anı, panel derleme anı; test olayı gönderilip `flush: true` alındı]. Mobil DSN EAS build'e kaldı. **§13 Faz 5 ops maddelerinin tamamı kapandı**; kalan tek şey mağaza paketleri ve prod HTTP yük ölçümü. 4.4: **§11.6 KAPANDI** — Cloudflare R2 bağlandı, yedek üç konumda [db makinesi + app makinesi + **R2, ayrı sağlayıcı**], token tek bucket'a kısıtlı, **restore provası R2 kaynağıyla geçti**. CI panel derlemesi hâlâ kırık; denenip işe yaramayan hipotezler §13'e yazıldı ki tekrarlanmasın. 4.3: **`platform` modülü + `/yonetim` ve `/hesap` ekranları** — davet akışını tetikleyecek bir şey yoktu [davet PLATFORM_ADMIN ister, satıcı oluşturma ucu da yoktu]. `platform.repository.ts` tenant filtresinin **bilerek atlandığı tek yer**; kapsam satıcı köküyle sınırlı, tenant içi veriye erişim yok [kural #3]. **DİKKAT: dağıtım elle** — CI derlemesi üç kez 30 dk astı, imajlar yerelde derlenip SSH ile gönderiliyor. 4.2: **onboarding kilidi çözüldü** — satıcı daveti akışı [TOTP anahtarı davet satırında bekler, hesap ancak kod doğrulanınca açılır → 2FA'sız SELLER_ADMIN hiç var olmaz]; `change-password` ucu eklendi; **kural #11 açığı kapatıldı** [üyeliksiz PLATFORM_ADMIN 2FA'sız girebiliyordu — 2FA kontrolü üyelik rolünden çözülüyordu, `toPayload` ile aynı mantığa alındı, mutasyonla doğrulanmış birim testi]; **font depoya alındı** [`next/font/google` derleme anında indiriyordu, CI'da iki kez 30 dk astı → düz `@font-face`, latin+latin-ext ayrı unicode-range]. Kalan: davet/parola arayüzleri, QR, posta gönderimi. 4.1: ilk satıcı+admin prod'da açıldı ve giriş doğrulandı; §13 Faz 5'e **üç onboarding eksiği** yazıldı — **2FA kilidi** [yeni SELLER_ADMIN kendi başına giremez: 2FA'sız giriş yasak ama 2FA kurulumu giriş istiyor], **parola değiştirme ucu yok**, **şifremi-unuttum posta gönderemiyor**. Üçü de pilot öncesi kapanmalı. 4.0: **PROD YAYINDA** — §13 Faz 5 ops bölümü gerçek altyapıyla güncellendi [iki Oracle Always Free x86 makinesi, Caddy, **Coolify yok**, imajlar CI'da derlenir, panel+API aynı köken]; sertleştirme ve şifreli yedek+restore provası işaretlendi; yedeğin iki eksiği [age özel anahtarı sunucudan çıkmalı, gerçek dış konum yok] ve prod DB'nin boş olduğu açıkça yazıldı. 3.9: **§12.1 marka varlık kuralları** [PNG kaynaktan alpha ayrıştırmasıyla üretilir — eşikle boyama harfleri içi boş çerçeveye çevirir; logolarda `unoptimized`; sütun-flex'te `self-start`; giriş eşiği 900px, marka alanı hiçbir genişlikte kaybolmaz] + **§12'ye "aynı queryKey → aynı şekil"** kuralı [paylaşılan `['buyers','all']` anahtarı iki farklı şekil yazıyordu → sekme geçişinde Raporlar çöküyordu; düzeltildi]. 3.8: **§12.1 Tasarım sistemi** eklendi [logodan OKLCH palet, ink≠slate, altın asla durum rengi değil, kontrast ölçülür, ters logo]; §2 mobil satırı düzeltildi — **NativeWind kurulu değil**, `StyleSheet` + `theme.ts`; mobilde `(tabs)` 4 sekme + AppHeader + /profil. 3.7: §13'e **Faz 6 — Backlog** bölümü kuruldu [§16.5 "Backlog" diyordu ama bölüm yoktu]; **B1 = ek dosya/görsel** özelliği [attachments tablosu + R2 + imzalı URL + magic-byte], B2 = ikinci POS adaptörü / RLS / ERP. 3.6: **§6.4 ekstre sorgusu yeniden kuruldu** [page + opening; 20k harekette 900ms→274ms, yük hedefi ölçüldü] + `transactions_ledger_covering_idx`; §14'e **görsel/dosya DB'ye konmaz** yasağı [ek dosyalar R2'ye, ayrı tabloya]. 3.5: §13 Faz 5 → **Sentry ×3 wiring koda alındı** [DSN'e kapılı, DSN'siz no-op]; ops tarafında kalan tek iş DSN üretimi. 3.4: Faz 5 KOD tarafı kapandı → §13'e 2FA enrollment/hesap silme/CSP/pino/HIBP/CI-Trivy-ZAP/yedek işaretlendi, §10'a `/auth/2fa/*` + `DELETE /auth/account`, `users`'a 4 alan [totp_pending_secret, totp_enabled_at, backup_codes, anonymized_at]; ops release kapısı `docs/DEPLOY.md`'de. 3.3: Faz 4 → §7'ye `push_tokens` + `support_requests`, §10'a katalog/bildirim/kur/export uçları. 3.2: Faz 3 → `sellers.seller_no`, tahsilat uçları ve hata kodları. 3.1: §6.4 bakiye SQL'i TRY normalizasyonu.) Claude Code her oturumun başında bu dosyayı okur ve buradaki kurallara MUTLAK uyar. Kullanıcı talebi bu dosyayla çelişirse: önce çelişkiyi bildir, onaysız kural çiğneme. Kod tabanının haritası için dosyaları grep'leme — **Graphify grafiğini sorgula** (§5).

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

| Katman                            | Seçimler                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Temel                             | TypeScript strict · Node ≥22 LTS · pnpm ≥9 · Turborepo · Zod (`packages/shared`) · decimal.js                                                                                                                                                                                                                                                               |
| Mobil `apps/mobile`               | Expo (güncel SDK) + Expo Router (`(tabs)` — 4 sekme) · TanStack Query v5 · Zustand (yalnız oturum/aktif hesap) · react-hook-form+zod · react-native-gifted-charts · expo-secure-store · expo-notifications · lucide-react-native · **`StyleSheet` + `src/lib/theme.ts`** (NativeWind DEĞİL — 17.07: kurulu olmadığı görüldü, tema dosyası tek renk kaynağı) |
| Panel `apps/panel`                | Next.js (App Router) · Tailwind v4 (`@theme`, globals.css) + shadcn/ui · Plus Jakarta Sans (`next/font`, self-host) · lucide-react · TanStack Table v8 (sunucu sayfalama) · Recharts · TanStack Query · react-hook-form+zod · exceljs                                                                                                                       |
| API `apps/api`                    | NestJS ≥11 · Prisma ≥6 (raporlarda `$queryRaw` serbest) · PostgreSQL ≥16 · Passport-JWT + argon2id · otplib (TOTP) · @nestjs/swagger `/docs` · @nestjs/throttler · @nestjs/schedule · pdfmake · fast-xml-parser (UBL) · pino (redaction'lı) · Vitest + Supertest                                                                                            |
| Lokal                             | Docker Compose: postgres:16-alpine + Mailpit + MinIO · ESLint+Prettier (sıfır uyarı) · husky+lint-staged+gitleaks · Playwright                                                                                                                                                                                                                              |
| Üretim (~€5/ay tek ücretli kalem) | Hetzner VPS + Docker + Coolify · Cloudflare DNS proxy + WAF + Pages + R2 + Turnstile · Resend (3k/ay) · Sentry · UptimeRobot · GitHub Actions · EAS ücretsiz kota / lokal build · TCMB resmî kur servisi                                                                                                                                                    |
| AI araç zinciri                   | Claude Code · **Graphify** (kod bilgi grafiği, §5) · Obsidian (graf görselleştirme)                                                                                                                                                                                                                                                                         |

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

**Yukarıdaki SQL anlamı tanımlar, uygulamayı değil.** Birebir uygulanırsa (window tüm tarihçede, LIMIT sonra) her istek carinin bütün hareketlerini sıralar → maliyet geçmişle doğrusal büyür. Ölçüldü (17.07, 100 eşzamanlı): 5k hareket 190ms · 10k 419ms · **20k 900ms → 500ms hedefi kırılıyor.** Bu yüzden `ledger.repository.ts` aynı sonucu iki parçada üretir:

1. `page` — istenen sayfa, indeksten, LIMIT kadar satır (tarih filtresi BURAYA uygulanır).
2. `opening` — sayfanın **en eski satırından önceki** her şeyin toplamı; tek SUM, sıralama yok, tarih filtresi YOK (devir ve filtre dışı geçmiş bakiyeye dahil olmalı).

`running_balance = opening + sayfa içindeki kümülatif toplam`. Window artık yalnız LIMIT kadar satır görür → 20k'da 900ms **→ 274ms**.

- **Sınır, en eski satırın `(document_date, id)` DEMETİ'dir.** Ayrı `MIN(document_date)`/`MIN(id)` farklı satırlardan gelip sınırı kaydırır → bakiye sessizce yanlış çıkar. Yalnız aynı güne birden çok hareket düşüp sayfa sınırını böldüğünde görünür; regresyon testi `ledger-pagination.e2e-spec.ts` (kasıtlı aynı-tarih yığını + elle verilmiş id'ler; mutasyonla doğrulandı — hatalı kurguda düşüyor).
- **`transactions_ledger_covering_idx`** (INCLUDE'lu kısmi indeks, migration'da — Prisma ifade edemez): `opening` **Index Only Scan / Heap Fetches: 0** ile çalışır. Sonuç: satır ne kadar genişlerse genişlesin ekstre hızı etkilenmez. **Bu indeks silinirse ekstre yavaşlar** (§14).

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
| `users`                      | email? UNIQUE, phone? UNIQUE, password_hash, totp_secret?, totp_pending_secret?, totp_enabled_at?, backup_codes[], anonymized_at?, is_active                                                  | Küresel kimlik (§6.2); 2FA enrollment + hesap silme alanları Faz 5 (§11.1/§11.6)                          |
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
| `push_tokens`                | user_id, token UNIQUE, platform, device_name?, last_seen_at                                                                                                                                   | **Tenant tablosu DEĞİL** — token kullanıcı+cihaz bazlı (§6.2); hesap bağlamı push payload'ında taşınır    |
| `support_requests`           | seller_id, buyer_account_id, created_by, type, subject, body, status, reply?, replied_by?, replied_at?                                                                                        | Talep-Öneri; §9 devir mutabakatı itirazı da buradan akar                                                  |
| `exchange_rates`             | date, currency_code, rate                                                                                                                                                                     | TCMB cron — **bilgi amaçlı**; satıra sabitlenen kuru DEĞİŞTİRMEZ                                          |
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
Uç grupları: `/auth` (login, refresh, logout, forgot, switch-account, sessions, revoke-all, **2fa/setup·enable·disable**, **DELETE account**) · `/buyers` · `/transactions` · `/invoices` · `/reports` (risk, periodic-balance, average-due, statement-pdf) · `/collections` (intents, intents/:id/confirm·cancel·pay, installments, guest/{sellerSlug}, statement-import → matches → confirm, pos-callback/{provider}) · `/sellers` (me, bank-accounts, pos-config, pos-providers) · `/imports` (wizard, ubl, presets) · `/products` (+ :id/stock, :id/active) · `/campaigns` (+ :id/announce) · `/notifications` (unread-count, read, tokens) · `/requests` (+ :id/reply·close) · `/exchange-rates` (latest, sync) · `/exports` (zarf dışında XLSX) · `/audit`.

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

**Aynı `queryKey` → aynı şekil (TanStack Query).** Bir anahtarı birden çok sayfa kullanıyorsa hepsi **aynı getiriciyi** kullanmalı. `['buyers','all']` dört sayfada paylaşılıyordu; üçü `apiGetPaged` ile `{data,meta}`, biri `apiGet` ile düz dizi yazıyordu → önbellekte hangi sayfa önce açıldıysa o kazanıyor, diğeri **çöküyor** (`.map is not a function`) veya sessizce boşalıyordu. Tek sayfa açıkken görünmez; yalnız sekmeler arası gezerken ortaya çıkar (18.07'de bulundu ve düzeltildi).

### 12.1 Tasarım sistemi (marka — 17.07)

Kaynak **logo**: lacivert `#152A55` · altın `#D5A215` · gri `#8A949E`. Ölçekler OKLCH'te kuruldu (ton sabit; sRGB'de beyaza karıştırmak rengi soldurup griye çevirir).

- **Tek renk kaynağı:** panel `globals.css` `@theme` · mobil `src/lib/theme.ts`. **Bileşene ham hex/`slate-500` yazılmaz** (ikisinde de 0 kaldı; 341 sınıf temizlendi). Mobil değerler panelin OKLCH'inden **hesaplanarak** üretilir — "yaklaşık aynı" tutulan iki palet zamanla ayrışır.
- **Nötrler `ink`** — logonun grisinden, lacivert tonlu (H=248). **Tailwind `slate` kullanılmaz:** her kurumsal panelde aynı görünür, markayı siler.
- **Altın = yalnız marka vurgusu** (aktif sekme, odak halkası, logo). ❌ Altın **asla** durum rengi olmaz — "marka" ve "uyarı" aynı renk olursa ayırt edilemez (uyarı H=45, altın H=85).
- **Durum renkleri anlamsal:** `debit` (borç) · `credit` (alacak) · `warn`. Badge tonları da öyle (`neutral|credit|debit|warn|brand`) — `green`/`red` gibi renk adı kullanılmaz.
- **Kontrast ölçülür, tahmin edilmez:** gövde metni WCAG AA (≥4.5). Ölçüldü: navy-900/ink-100 12.71 · ink-600 4.64 · debit 5.34 · credit 4.56. Palet değişirse **yeniden ölçülür** — para gövde metnidir (kural #1'in görsel karşılığı).
- **Rakamlar tabular** (panel `font-variant-numeric`, mobil `numeric`): `1.000,00` ile `9.999,99` alt alta kaymaz.
- **Logo koyu zeminde:** `*-reverse.png` varyantı (lacivert→beyaz; altın/gri korunur). ❌ `brightness-0 invert` — logoyu tek beyaz lekeye çevirir.
- **Marka PNG'leri kaynaktan üretilir, elle boyanmaz** (18.07). Varlıklar `carinet_logo.PNG`'den, her piksel _(beyaz zemin + marka rengi)_ karışımı olarak çözülüp **kapsam (alpha) ile renk ayrı ayrı** yazılarak üretilir; ters varyantta yalnız renk değişir, kenar yumuşaklığı aynı kalır. ❌ Eşikle "lacivert→beyaz" boyama: iç pikseller döner, anti-aliasing kenarları lacivert kalır → **harfler içi boş çerçeveye döner** (ilk üretimde tam olarak bu oldu). Kaynağın beyazı tam 255 değil (~12/255 gürültü) → alpha'da taban kesilmezse zemin hayalet sis olarak kalır.
- **Logolarda `unoptimized`** (next/image): düz renkli logoyu WebP'ye yeniden kodlamak kenarları yumuşatır; dosya ~30KB, optimize etmeye değmez. Ayrıca `width/height` varlığın **gerçek** boyutu olmalı (933×234 / 208×234).
- **Sütun-flex içinde logo `self-start` ister:** `align-items: stretch` çocuğu çapraz eksende gerer, `w-auto` bunu engellemez → logo bandın tamamına yayılır.
- **Giriş ekranı eşiği `lg` değil `900px`:** 1024px eşiğinde 972px'lik sıradan bir dizüstü ekranında marka alanı tamamen kayboluyordu. Marka alanı hiçbir genişlikte yok olmaz — dar ekranda üst banda döner.

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
> **Push:** ortak hat bildirimi `notifications` tablosuna yazar; cihaza gönderim Faz 4'te eklendi (commit sonrası, best-effort).
> **Pilotun POS sağlayıcısı belli olunca** ikinci adaptör yazılır (§8: "adaptörler talep geldikçe eklenir").

### Faz 4 — Katalog ve İletişim (3–4 hafta) — ✅ TAMAMLANDI (14.07.2026)

- [x] Ürünler+Stoklar (panel CRUD+mobil vitrin) · Kampanyalar+push duyuru
- [x] Push altyapısı (Expo Push API, ücretsiz): vade hatırlatma (cron), tahsilat onayı, kampanya, talep yanıtı — payload hesap bağlamlı (`sellerId`+`buyerAccountId`)
- [x] Bildirim merkezi (hesap bazlı rozet) · Talep-Öneri · TCMB kur cronu+Kurlar ekranı · Excel dışa aktarma (CSV injection korumalı)
      **✅ Bitti:** vadesi yaklaşan fatura cron bildirimi üretiyor ✅; kampanya push'u hesap bağlamıyla ulaşıyor ✅ — `catalog.e2e-spec.ts` (21 test).

> **Vade hatırlatması yalnız AÇIK kalemlere gider** (FIFO — Faz 2): ödemiş müşteriye "borcunuz var" denmez. Tekrar 1/7/30. günlerle sınırlı (her gün spam yok).
> **Push, DB bildiriminden sonra ve transaction DIŞINDA gönderilir** — geri alınan bir işlem için telefon çalmaz. Push best-effort: başarısız olsa da bildirim merkezi çalışır.
> **Kur bilgi amaçlıdır** — faturaya yazılan kur kayıt anında satıra sabitlenir (§7), geçmişe dönük kur değişimi bakiyeyi oynatmaz.

### Faz 5 — Sertleştirme ve Yayın (2 hafta) — KOD TARAFI TAMAM (15.07.2026); OPS bekliyor

**Kod tarafı (bu oturumda, testli — bkz. PROGRESS.md 15.07.2026):**

- [x] **2FA enrollment** (`/auth/2fa/setup·enable·disable` + yedek kodlar) · girişte TOTP/recovery · revoke-all (Faz 0)
- [x] **Hesap silme / anonimleştirme** (`DELETE /auth/account`, finansal kayıt kalır) + KVKK sayfaları (panel + mobil)
- [x] **§11.2 sertleştirme**: Helmet sıkı CSP + prod HSTS · **pino redaction** · Swagger prod basic auth (gerçek boot doğrulaması)
- [x] **Sızmış parola** (HIBP k-anonimlik, fail-open, §11.1)
- [x] **CI**: Trivy fs + ZAP baseline + Dependabot + Actions SHA pin (§11.7)
- [x] **Şifreli yedek + restore** scriptleri (pg_dump | age → R2) + restore provası rehberi
- [x] **Sentry ×3 wiring** (§11.8) — API `instrument.ts` (main'den önce, yalnız 5xx) · panel `withSentryConfig` · mobil `Sentry.wrap`; hepsi DSN'e kapılı

**Ops tarafı (release kapısı — sunucu/hesap gerektirir → `docs/DEPLOY.md`, KULLANICI ADIMI):**

> **PROD YAYINDA (18.07.2026): `https://89.168.125.160.sslip.io` — maliyet 0.** Altyapı: **iki
> Oracle Always Free x86 makinesi** (`E2.1.Micro`, 954 MB). ARM (`A1.Flex`) kapasitesi 81 denemede
> üç AD'de de bulunamadı; x86 ilk denemede açıldı. `carinet-db` = Postgres (yalnız iç ağ),
> `carinet-app` = API + panel + **Caddy** (Let's Encrypt). **Coolify KULLANILMIYOR** (tek başına
> ~1 GB); düz `docker compose`. İmajlar **GitHub Actions'ta** derlenip ghcr'den çekilir — 954 MB'da
> Next derlemesi yapılamaz. Panel ve API **aynı kökende** (Caddy `/v1` → API): httpOnly cookie
> çapraz-köken sorunu ve CORS ihtiyacı doğmaz.

- [x] VPS sertleştirme (UFW/fail2ban/SSH/swap/otomatik güncelleme) — iki makinede, **yeniden başlatma testi geçti**
- [x] Şifreli yedek (`pg_dump | age`, gece 03:15, 30 gün) + **restore provası GEÇTİ** (30 tablo · ledger indeksi · 6 migrasyon doğrulandı)
- [x] **Yedeğin dış konumu TAMAM** (20.07) — Cloudflare R2 bağlandı, üç konum: db makinesi + app makinesi + **R2 (ayrı sağlayıcı)**. Token tek bucket'a kısıtlı. **Restore provası R2 kaynağıyla geçti** (`/opt/carinet/r2-restore-provasi.sh` — indir, çöz, ayrı DB'ye yükle, doğrula). age özel anahtarı kullanıcının parola yöneticisinde
- [ ] Cloudflare kenar katmanı (WAF/Turnstile) — **opsiyonel**, kodda `TURNSTILE_SECRET` zaten `optional`
- [x] **Sentry — API ve panel CANLI** (20.07): hesap **AB bölgesinde** (`ingest.de.sentry.io` → hata verisi Avrupa'da, KVKK'da rahat). API DSN'i sunucuda `.env`'de (**çalışma anı**, yeniden derleme gerekmez); panel DSN'i imaja gömülü (**derleme anı**) ve CI için repo değişkeni olarak kayıtlı. **Doğrulandı:** API'den kontrollü test olayı gönderildi, `flush: true`; panel DSN'i canlı paketten teyit edildi
- [ ] **Mobil DSN** (`EXPO_PUBLIC_SENTRY_DSN`) — proje açıldı, DSN kullanıcıda; mobil henüz derlenmediği için EAS build'e geçince eklenecek
- [ ] 2FA **zorunlu** SELLER_ADMIN/PLATFORM_ADMIN (kod prod'da uygular; adminler kurulumu tamamlamalı)
- [x] İlk satıcı + SELLER_ADMIN açıldı (19.07) — `CariNet Test`, giriş uçtan uca doğrulandı (2FA'sız 401 · TOTP ile 200 · yanlış parola 401)
- [x] **ONBOARDING KİLİDİ ÇÖZÜLDÜ** (19.07) — satıcı daveti akışı: aday TOTP anahtarı **davet satırında** bekler, kullanıcı kaydı ancak kod doğrulandıktan **sonra** açılır → 2FA'sız bir SELLER_ADMIN hiçbir an var olmaz. `POST /auth/seller-invites` + `seller-invite/start|complete` + panel `/davet/[token]`; 9 e2e testi
- [x] **Parola değiştirme ucu** eklendi (`POST /auth/change-password`, mevcut parola zorunlu, tüm oturumlar düşer) — **arayüzü henüz yok**
- [x] **`/yonetim`** (20.07) — platform admini alanı: satıcı listesi/oluşturma/aktiflik + tek tıkla yönetici daveti. Yeni **`platform` modülü**: `GET/POST /v1/platform/sellers`, `PATCH .../active`, `GET .../invites`
- [x] **`/hesap`** (20.07) — parola değiştirme ekranı; giriş artık role göre yönlendiriyor (platform admini `/yonetim`, satıcı `/panel`)
- [ ] **DAĞITIM ELLE (gerileme):** panel imajı CI'da 30 dk aşıyor (aynı derleme yerelde **37 sn**). API `cache-to: mode=min` ile düzeldi. **Panel için denenip İŞE YARAMAYANLAR — tekrar denenmesin:** `mode=min`, Sentry `telemetry: false`. (Font yerelleştirmesi gerçek bir sorundu ve çözüldü, ama tek sebep değilmiş.) İmajlar yerelde derlenip `docker save | ssh docker load` ile gönderiliyor, compose `carinet-*:local`. CI düzelirse compose **ghcr'ye geri alınmalı**
- [ ] **2FA kurulumunda QR kodu yok** — kurulum anahtarı elle giriliyor; QR kütüphanesi kurulumu bu makinede sürekli başarısız (OneDrive/pnpm)
- [ ] **"Şifremi unuttum" prod'da çalışmıyor** — uç var ama posta gönderimi yapılandırılmamış (SMTP varsayılanı Mailpit, `RESEND_API_KEY` yok). Bir satıcı parolasını unutursa çaresiz kalır. Çözüm ücretsiz: Resend (§2, 3k/ay)
- [ ] Mağaza paketleri + demo hesap · yük hedefi: 100 eşzamanlı ekstre <500ms — **DB katmanı 17.07'de ölçüldü** (§6.4: 20k harekette 274ms); prod'da HTTP ucuyla tekrarlanacak
      **✅ Bitti:** güvenlik listesi %100 · restore bir kez kanıtlı · uygulama mağaza incelemesinde · prod izleniyor.

### Faz 6 — Backlog (v1 sonrası)

§16.5'in "Backlog notu" dediği yer burasıdır. **Sıra ve kapsam pilot geri bildirimiyle netleşir; buradaki hiçbir madde Faz 5 kapanmadan başlamaz.**

#### B1 — Ek dosya / görsel (fatura görüntüsü, dekont, ürün fotoğrafı)

Faz 5'te (17.07) yalnız **tasarım kısıtı** sabitlendi (§14: içerik DB'ye konmaz) ve ekstre bu özelliğe hazır hale getirildi (`transactions_ledger_covering_idx` → satır genişliği ekstre hızını etkilemez, §6.4). Özelliğin kendisi yapılmadı.

**Kapsam:**

- `attachments` tablosu — **tenant tablosu** (`seller_id` zorunlu, kural #3): `id, seller_id, storage_key, mime, size_bytes, sha256, original_name, uploaded_by, created_at, deleted_at?` + sahiplik FK'leri `invoice_id? / transaction_id? / collect_intent_id? / support_request_id?` ve **tam olarak biri dolu** CHECK'i. (Polimorfik `owner_type/owner_id` yerine açık FK: referans bütünlüğü DB'de kalsın.)
- **İçerik R2/MinIO'da, tabloda yalnız anahtar** (§14). Private bucket; okuma **kısa ömürlü imzalı URL** ile (§11.2). Public URL yok.
- **Yükleme doğrulaması (§11.2):** uzantı + MIME + **magic-byte** üçü birden · allowlist (jpeg/png/webp/pdf) · görsel ≤5MB, PDF ≤10MB · `sha256` ile mükerrer tespiti.
- **Silme:** ek dosya finansal kayıt DEĞİLDİR, silinebilir — ama finansal bir kayda bağlıysa `deleted_at` + **audit** (kural #4 ile karışmasın: hareket durur, eki gider). R2 nesnesi saklama süresi sonunda temizlenir.
- **Yedek:** R2 kendi lifecycle/versioning'iyle korunur; `pg_dump`'a **girmez** (§11.6 — gece yedeği şişmesin).
- Panel: fatura/hareket ekranında yükle-listele-sil. Mobil: fatura detayında görüntüle (imzalı URL).
- Test: cross-tenant (A'nın eki B'ye görünmez/indirilemez) · magic-byte reddi · imzalı URL süresi dolunca 403.

**Açık sorular (pilotla netleşecek):** alıcı **dekont** yükleyebilecek mi (§8 Kanal 1'de "açıklamasız dekont" akışını kolaylaştırır) · saklama süresi (KVKK/yasal) · e-Fatura PDF'i zaten entegratörde varken kopyasını tutmak gerekli mi.

#### B2 — Diğer

- **İkinci POS adaptörü** — pilotun sağlayıcısı belli olunca (§8: "adaptörler talep geldikçe eklenir").
- **PostgreSQL RLS** — §6.1'in "opsiyonel son kemer"i.
- **ERP entegrasyonu** — v1 dışı (§14); kapı §9'daki import uçları.

---

## 14. Yapılmayacaklar (açık yasaklar)

❌ Parada float/number · ❌ `balance` kolonu · ❌ `seller_id` filtresiz sorgu · ❌ finansal kayıtta hard delete · ❌ kart verisi işlemek/loglamak/formunu barındırmak · ❌ platform hesabında para toplamak (facilitator) · ❌ onaysız ücretli servis (AI eşleyici ve `--mode deep` dahil) · ❌ ERP gerçek-zaman entegrasyonuna başlamak (v1 dışı; kapı §9'daki import uçları) · ❌ `localStorage`'da token · ❌ Swagger güncellenmeden endpoint değişikliği · ❌ kullanılmayan soyutlama (YAGNI) · ❌ testi geçirmek için testi zayıflatmak · ❌ kullanıcı↔cari ilişkisini 1-1 kurmak (§6.2) · ❌ **dosya/görsel içeriğini (`bytea`) veritabanında tutmak** (aşağı) · ❌ **`transactions_ledger_covering_idx`'i düşürmek** (§6.4 — ekstre hızının temeli; Prisma "fazlalık" sanıp DROP önerebilir).

**Görsel/ek dosyalar (fatura görüntüsü, dekont, ürün fotoğrafı) — DB'ye değil R2/MinIO'ya.** Tabloda yalnız anahtar/URL + meta durur; içerik private bucket'ta, erişim imzalı URL ile (§11.2). Ek dosyalar `transactions`'a kolon olarak DEĞİL, ayrı bir tabloya bağlanır (1:N; finansal kayıt silinmez ama ek dosya silinebilir — kural #4 karışmasın).

> Not (17.07 ölçümü): gerekçe performans DEĞİL — Postgres TOAST büyük `bytea`'yı satır dışına taşıdığı için tarama beklendiği kadar yavaşlamıyor (16.7ms → 20.4ms). Gerçek gerekçeler: **gece şifreli yedek** (§11.6) her gece tüm görselleri yeniden dump'lar → yedek/restore süresi ve R2 maliyeti patlar; imzalı URL modeli (§11.2) zaten nesne deposu ister; ve WAL/replikasyon şişer.

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
