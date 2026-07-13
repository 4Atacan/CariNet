# PROGRESS.md — CariNet AI Calisma Gunlugu

> Bu dosya oturumlar arasi hafizadir (CLAUDE.md §16.3). Her calisma blogu sonunda guncellenir.
> **Aktif faz: Faz 0 — Iskelet ve Temel** → tamamlandi, Faz 1'e gecise hazir.

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
