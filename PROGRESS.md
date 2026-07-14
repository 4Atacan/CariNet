# PROGRESS.md — CariNet AI Calisma Gunlugu

> Bu dosya oturumlar arasi hafizadir (CLAUDE.md §16.3). Her calisma blogu sonunda guncellenir.
> **Aktif faz: Faz 1 — Cekirdek MVP** → kod tamamlandi; pilot verisiyle sifir-fark testi BEKLIYOR (bkz. asagi).

---

## 2026-07-14 · Faz 1 — Cekirdek MVP

Faz 1 dort bloga bolunerek uygulandi: (A) finansal cekirdek, (B) import hatti + Gecis Sihirbazi,
(C) panel UI, (D) mobil.

### Yapilan

**Blok A — finansal cekirdek (API)**

- `packages/shared`: cari/hareket/fatura Zod semalari; `invoice.ts` — fatura kalem/toplam hesabi
  (satir bazli yuvarlama → "kalemler toplami ≠ fatura toplami" kurus farki olusmaz), 9 unit test.
- `ledger` modulu: bakiyenin TEK kaynagi (kural #2). Yuruyen bakiye §6.4'un window function'i ile
  sorgu aninda; toplu bakiye tek sorguda (cari listesinde N+1 yok).
- `buyers`: tam CRUD + cari kodu tarihcesi + pasife alma (silme YOK) + canli bakiye + `/buyers/me`
  (mobil dashboard) + `/buyers/me/statement` (mobil ekstre).
- `representatives`: CRUD. `transactions`: giris + iptal. `invoices`: fatura+kalem+otomatik DEBIT
  hareketi TEK transactionda; iptal bagli hareketi de iptal eder.
- `audit`: finansal degisimde zorunlu kayit; ayni DB transaction'inda yazilir (kural #4).

**Blok B — import hatti (§6.6) + Gecis Sihirbazi (§9)**

- Sema: `import_batches.target` + `import_templates` (onaylanan esleme sablonu) + migration.
- `shared`: kolon takma adi eslemesi (`autoMap` — "Cari Kodu", "Borç", "Vade"… tanir), TR/EN sayi
  bicimleri ("1.234,56" ↔ "1,234.56"), parantezli negatif, Excel seri tarihi, **formul enjeksiyonu
  etkisizlestirme** (§11.3), satir semalari (borc/alacak → yon + tutar).
- Hat: yukle → ayristir → satir satir Zod → staging (`import_rows`) → onizleme + hata raporu
  (satir no + sebep) → onay → **tek DB transaction** commit → toplu iptal (`is_cancelled`).
- **Gecis Sihirbazi**: kesim tarihi + devir; **Dogrulama Raporu** — satici programinin toplamiyla
  fark varsa commit REDDEDILIR ("fark kapanmadan go-live yok").
- **UBL-TR**: XML/ZIP ayristirma (fast-xml-parser), **VKN ile cari eslesmesi**, fatura+kalem+DEBIT.
  Eslesmeyen VKN commit'i durdurur (veri sessizce yanlis cariye yazilmaz).
- MinIO/R2 arsivleme + sha256 mukerrer dosya uyarisi.

**Blok C — panel (Next.js 15 + shadcn/ui deseni + TanStack Table v8)**

Ozet · Cari listesi (canli bakiye, arama, sunucu sayfalamasi) · Cari detayi (bakiye kartlari, ekstre,
davet linki, pasife alma) · Hareketler (+ giris formu, iptal) · Faturalar (+ kalemli form, canli
toplam onizlemesi) · Ice aktarim (yukle → onizleme/hata → onay) · Gecis sihirbazi (dogrulama raporu)
· Temsilciler.

**Blok D — mobil (Expo 53)**

Dashboard (bakiye, limit + kullanim, temsilci, borc/alacak donut grafigi, son 10 hareket) ·
Ekstre (tarih filtresi + yuruyen bakiye + **sonsuz kaydirma**) · Fatura detayi (kalemler + satir
bazli kur) · **Beni hatirla** (kapaliysa token kalici yazilmaz, oturum bellekte kalir).

**Testler:** 36 unit (shared: para + fatura + import) + 6 unit (AES) + **78 e2e** — hepsi yesil.
Yeni e2e dosyalari: `buyers`, `transactions`, `invoices`, `imports` (her birinde cross-tenant matrisi).

### Kararlar

1. **Bakiye TRY'ye normalize edilir** (asagidaki UYUSMAZLIK maddesi): `ROUND(amount × exchange_rate, 2)`.
   Tum satirlar TRY iken (kur = 1) §6.4'un SQL'i ile birebir ayni sonucu verir.
2. Fatura toplami istemciden ALINMAZ; sunucuda `computeInvoiceTotals` ile hesaplanir (panel ayni
   fonksiyonu yalniz onizleme icin cagirir).
3. Faturaya/tahsilata bagli hareket **tek basina** iptal edilemez; fatura iptali bagli hareketi de iptal eder.
4. Import staging asamasi **hicbir finansal kayit yazmaz**; yazma yalniz commit'te ve tek transactionda olur.
5. Mevcut cari, cari-listesi importunda EZILMEZ (atlanir); guncelleme panelden yapilir.
6. Ayni cariye ikinci kez devir girilemez (once mevcut devir iptal edilmeli).
7. Cari hesap silinmez → `isActive = false`; pasif cariye hareket girilemez.
8. Ham SQL (`$queryRaw`) tenant eklentisinin DISINDADIR → `ledger.repository.ts` her sorguda
   `seller_id`'yi baglamdan okuyup ELLE koyar; baglam yoksa sorgu atilmaz.

### CLAUDE.md ile UYUSMAZLIK → **COZULDU (kullanici onayi, 14.07.2026)**

- **§6.4'un SQL'i ham `amount` topluyordu.** Seed'deki USD faturasi `amount = 6000 USD, rate = 38.4210`
  olarak duruyor; ham toplama USD ile TRY'yi karistirir ("tek bir kurus yanlis hesaplanmamali" ilkesine
  aykiri). Bakiye/ekstre `ROUND(amount × exchange_rate, 2)` ile TRY'ye normalize edildi (satir bazli
  yuvarlama). TRY satirlarda kur 1 oldugu icin eski ifadeye indirgenir.
  → **CLAUDE.md §6.4 guncellendi (surum 3.1)**; kod zaten bu haldeydi, degisiklik gerekmedi.

### VARSAYIM (CLAUDE.md §7'ye eklenmesi onerilir)

- `import_batches.target` (ImportTarget enum) — ayni dosya bicimi farkli tablolara yazilabilir; §9'un
  dort kanali (cari listesi / hareket / devir / UBL) icin hedef alani sart.
- `import_templates` tablosu — §9 "onaylanan esleme sablon olarak saklanir" maddesinin karsiligi.
- `import_batches.file_name` + `mapping` (jsonb) — kullanilan kolon eslemesi ve kesim tarihi burada tutulur.
- **Kredi limiti Faz 1'de BLOKLAMAZ** (yalniz gosterilir): §7'de limit var ama "limit asilinca hareket
  girilemez" kurali yok; `CREDIT_LIMIT_EXCEEDED` hata kodu tahsilat/siparis akislari icin ayrildi.
  Risk foyunde limit kullanimi Faz 2'de raporlanacak.

### Bitti kriteri kontrolu (Faz 1)

- [x] 200 satirlik Excel hatasiz (e2e testi: ayristirma + commit + bakiye dogrulamasi)
- [x] Bakiye = Σ hareket (e2e: API bakiyesi ham hareketlerden elle hesaplanana esit)
- [x] Coklu-uyelik gecisi calisiyor (Faz 0'dan devam; mobil hesap degistirici canli)
- [x] Panel: cari CRUD + hareket + fatura + Excel import + Gecis Sihirbazi + davet linki
- [x] Mobil: Dashboard + Ekstre (yuruyen bakiye) + Fatura detayi
- [ ] **Pilotun gercek verisi sihirbazla sifir farkla tasindi** → gercek veri gerektirir, KULLANICI ADIMI
- [ ] Pilot saticiya gosterilebilir → yukaridaki adimdan sonra

### Sonraki adim

Faz 2 — Finansal Raporlar: Risk Foyu (yaslandirma 0-30/31-60/61-90/90+, limit %), Donemsel Bakiye
(raw SQL + grafik), Ortalama Vade (tutar agirlikli), Adresler, Ekstre PDF (pdfmake), panel ozet raporu.

---

## 2026-07-13 · Faz 0 — Iskelet ve Temel

### Yapilan

**Depo iskeleti**

- pnpm 11 + Turborepo monorepo (`apps/api`, `apps/panel`, `apps/mobile`, `packages/shared`, `packages/config`).
- `docker-compose.yml`: postgres:16-alpine + Mailpit (UI :8025) + MinIO (private `carinet` bucket, otomatik olusturulur).
- `.env.example` + lokal `.env` (gercek rastgele sirlarla uretildi), `.graphifyignore`, `.gitleaks.toml`.
- ESLint 9 flat config + Prettier + husky/lint-staged + gitleaks pre-commit kancasi.

**packages/shared**

- Enumlar (§7), `errors.ts` (kod → Turkce mesaj → HTTP durum eslemesi), Zod semalari (auth, sayfalama).
- `money.ts`: decimal.js sarmalayici — `toMoney/add/sub/mul/div/sum/computeBalance/computeRunningBalances`.
  `number` bilerek tip disinda birakildi (kural #1). **14 unit test yesil.**

**apps/api (NestJS 11 + Prisma 6)**

- §7'nin TAM tablo seti + ilk migration (`20260713131804_init`).
- **2 saticili seed**: 7 kullanici, 4 cari, **68 hareket** (3 DEVIR + farkli vadeler), 2 fatura (**biri USD, kur satira sabit**),
  1 bekleyen `collect_intent` + uretilen ornek banka ekstresi CSV'si, satici-2'de sandbox POS config (AES-256-GCM sifreli),
  2+2 urun/stok, 2 kampanya, TCMB kur ornegi. **Coklu uyelik kurgusu var**: `mehmet@zincirmarket.com` hem satici-1 hem satici-2 carisi.
- Auth: login (argon2id, tek tip yanit), refresh **rotasyonu + reuse tespiti → aile toptan iptal**, logout, revoke-all,
  sessions, me, memberships, **switch-account**, forgot/reset password (Mailpit), davet uret/kabul et.
- Tenant izolasyonu **uc kemerli** (§6.1): JWT baglami → `TenantGuard` → **Prisma client extension** (`tenant-guard.extension.ts`)
  her tenant modeline `seller_id` enjekte eder; baglam yoksa sorgu CALISMAZ.
- Yanit zarfi interceptor + `AllExceptionsFilter` (Prisma/Zod/AppError → §10 zarfi, ic detay sizmaz) + Swagger `/docs` (nestjs-zod ile semalar otomatik).
- `buyers` modulu (yalniz okuma) — tenant izolasyonunun kanit zemini; tam CRUD Faz 1'de.
- **Testler: 6 unit (AES) + 14 unit (para, shared) + 25 e2e (auth + cross-tenant matrisi) = hepsi yesil.**

**apps/panel (Next.js 15)** — `/giris` (react-hook-form + Zod, cookie tabanli oturum) → `/panel` (me + uyelikler + cari listesi).
**apps/mobile (Expo 52 + Router)** — `/giris` → `/ana-sayfa` (aktif hesap karti + **hesap degistirici** + cikis), token'lar `expo-secure-store`'da.

**CI** — `.github/workflows/ci.yml`: gitleaks · lint · typecheck · unit test · migrate · **e2e (postgres service)** · build · `pnpm audit`.

**Graphify (§5)** — `uv` + `graphifyy` kuruldu, skill + `.husky/post-commit` kancasi yerinde.
Ilk grafik: **1007 dugum, 1420 kenar, 93 topluluk** (AST modu → 0 token, kural #8).

### Kararlar

1. **Tenant filtresi Prisma eklentisiyle zorlanir** (repo'da elle `where: { sellerId }` yazilmaz). Yeni tenant tablosu
   eklendiginde `TENANT_MODELS` listesine de eklenmelidir — aksi halde sessizce korumasiz kalir.
2. Tenant modellerinde **`findUnique` yerine `findFirst`** kullanilir (eklenti filtreyi where'e enjekte edebilsin diye).
3. Auth, tenant baglami olusmadan calistigi icin `TenantContext.runAsSystem()` kullanir. Bu kacis kapisi **yalniz**
   `auth.repository.ts` + seed + cron icindir.
4. Refresh token = imzali JWT, DB'de `sha256(token)` saklanir. Rotasyonda eski kayit `revoked` isaretlenir;
   revoked bir token tekrar gelirse **ailenin tamami** iptal edilir.
5. Panel httpOnly cookie, mobil SecureStore (kural #9). Login yaniti her ikisini de besler.
6. `consistent-type-imports` kurali API paketinde KAPALI — Nest DI `design:paramtypes` metadata'sina baglidir,
   `import type` DI'yi coker.
7. pnpm `nodeLinker: hoisted` — Expo/Metro izole node_modules'te gecisli bagimliliklari cozemiyor.
8. Rate limit `NODE_ENV=test` iken kapali (`ThrottlerModule.skipIf`); dev/prod'da her zaman acik.

### CLAUDE.md ile UYUSMAZLIK (§16.4 — bildiriliyor, onaysiz kural degistirilmedi)

- **§3 / §5: `docs/graph/` vault'u.** Kurulu `graphifyy` surumunde `--obsidian` / `--obsidian-dir`
  bayraklari YOK (komut sessizce yok sayiyor). Grafik aracin kanonik klasorune yaziliyor: **`graphify-out/`**
  (`graph.json`, `GRAPH_REPORT.md`, `graph.html`). `docs/graph/README.md` bunu isaret ediyor.
  → CLAUDE.md §3/§5 guncellenmeli mi, kullanici karari.
- **§2: Expo SDK.** Panel (Next 15 → React 19) ile mobil (Expo 52 → React 18) ayni hoisted
  node_modules'te iki React uretti → panel prerender'i "useContext of null" ile coktu.
  **Cozum: Expo SDK 53 + RN 0.79 + tum workspace tek React 19** (`pnpm-workspace.yaml` overrides).
  CLAUDE.md "kurulumda en guncel kararliyi kullan" dedigi icin bu kural ihlali degil, kayit amacli.

### VARSAYIM (CLAUDE.md §7'ye eklenmesi onerilir)

- `users.full_name` — §7'de yok ama kimlik gosterimi icin zorunlu.
- `users.is_platform_admin` — PLATFORM_ADMIN rolunun tasiyicisi; §7'de rol kolonu yok, uyelik de yok.
- `password_reset_tokens` tablosu — Faz 0 "sifre sifirlama" maddesi icin gerekli, §7'de listelenmemis.
- `collect_intents.statement_row_id` yerine FK `bank_statement_rows.matched_intent_id` uzerinde (1-1 geri iliski);
  Prisma'da tek tarafli FK zorunlu.
- 2FA: login'de **dogrulama** var (secret varsa kod zorunlu) + prod'da SELLER_ADMIN/PLATFORM_ADMIN icin secret yoksa
  giris engellenir. **Kurulum (enrollment) uclari Faz 5'te.**

### Bitti kriteri kontrolu (Faz 0)

- [x] Iki saticinin kullanicilariyla giris calisiyor
- [x] A → B verisine erisemiyor — **11 e2e testiyle kanitli** (liste, ID ile IDOR, ters yon, ayni satici icinde yatay yetki,
      coklu uyelikte switch sonrasi baglam degisimi, baglamsiz Prisma sorgusunun reddi)
- [x] Prisma semasi + migration + 2 saticili seed
- [x] Yanit zarfi + exception filter + Swagger
- [x] CI: lint + typecheck + test + build + gitleaks
- [x] **Graphify kurulumu** — skill + post-commit kancasi + ilk grafik (`graphify-out/`)
- [x] Mobil ve panelde login calisir

### Sonraki adim

Faz 1 — Cekirdek MVP: cari CRUD + hareket girisi + fatura/kalem + Excel import + **Gecis Sihirbazi** (§9),
mobilde Dashboard/Ekstre/Fatura detayi. (Panelde shadcn/ui kurulumu Faz 1'in ilk isi.)

---

## Sablon (her blok icin)

```
## YYYY-AA-GG · Faz N — Baslik
### Yapilan
### Karar
### VARSAYIM:
### Sonraki adim
```
