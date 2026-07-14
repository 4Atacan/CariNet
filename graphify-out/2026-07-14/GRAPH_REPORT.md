# Graph Report - CariNet (2026-07-14)

## Corpus Check

- 201 files · ~77,806 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 2086 nodes · 3874 edges · 188 communities (100 shown, 88 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness

- Built from commit: `28475f8b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)

- types.ts
- BuyersService
- ImportsRepository
- pdf.service.ts
- ana-sayfa.tsx
- .log
- CollectionsController
- compilerOptions
- money.ts
- statement.service.ts
- RepresentativesController
- PrismaService
- index.ts
- sandbox-pos.adapter.ts
- package.json
- AuthController
- CLAUDE.md — CariNet · B2B Cari Hesap Platformu (Ana Beyin)
- Env
- AddressesService
- collections.module.ts
- package.json
- AuthRepository
- TxClient
- exports
- InvoicesRepository
- TransactionsRepository
- auth.ts
- app.module.ts
- collections.ts
- imports.ts
- globalEnv
- compilerOptions
- invoices.ts
- TenantContext
- compilerOptions
- test-app.ts
- AuthService
- dependencies
- tsconfig.json
- dependencies
- devDependencies
- collections.ts
- enums.ts
- InvoicesController
- TransactionsController
- expo
- devDependencies
- scripts
- TokenService
- exclude
- compilerOptions
- dependencies
- ubl.parser.ts
- scripts
- import.spec.ts
- index.ts
- buyers.ts
- 2026-07-13 · Faz 0 — Iskelet ve Temel
- base.js
- tasks
- devDependencies
- scripts
- import-cells.ts
- common.ts
- tenant-guard.extension.ts
- transactions.ts
- seed.ts
- Paginated
- auth.dto.ts
- exclude
- nest-cli.json
- encryption.ts
- AllExceptionsFilter
- package.json
- .constructor
- PrismaModule
- outputs
- metro.config.js
- layout.tsx
- post-commit
- row
- post-checkout
- turbo.json
- dev
- argon2
- @aws-sdk/client-s3
- @carinet/shared
- cookie-parser
- decimal.js
- fast-xml-parser
- helmet
- @nestjs/common
- @nestjs/config
- @nestjs/core
- @nestjs/jwt
- @nestjs/passport
- @nestjs/schedule
- @nestjs/swagger
- @nestjs/throttler
- nestjs-zod
- nodemailer
- otplib
- passport-jwt
- pdfmake
- pino
- reflect-metadata
- rxjs
- zod
- dotenv-cli
- @nestjs/schematics
- @nestjs/testing
- prisma
- supertest
- @swc/core
- tsx
- @types/adm-zip
- @types/cookie-parser
- @types/multer
- @types/node
- @types/passport-jwt
- @types/supertest
- typescript
- unplugin-swc
- vite-tsconfig-paths
- vitest
- expo-env.d.ts
- @babel/runtime
- expo
- expo-constants
- expo-router
- expo-sharing
- expo-status-bar
- @hookform/resolvers
- react
- react-hook-form
- react-native
- react-native-gifted-charts
- react-native-linear-gradient
- react-native-safe-area-context
- react-native-screens
- @tanstack/react-query
- zod
- next-env.d.ts
- @hookform/resolvers
- next
- @radix-ui/react-dialog
- @radix-ui/react-label
- @radix-ui/react-slot
- react
- react-dom
- react-hook-form
- recharts
- zod
- ApiConsumes
- ApiOperation
- ApiTags
- Body
- Controller
- CurrentUser
- Delete
- Get
- Global
- Param
- Patch
- Post
- Query
- Res
- Roles
- Throttle
- UseInterceptors
- collections.controller.ts
- imports.controller.ts
- .import

## God Nodes (most connected - your core abstractions)

1. `PrismaService` - 48 edges
2. `TxClient` - 45 edges
3. `CollectionsRepository` - 41 edges
4. `AuthRepository` - 33 edges
5. `apiPost()` - 29 edges
6. `TenantContext` - 27 edges
7. `AuditService` - 25 edges
8. `ImportsRepository` - 25 edges
9. `AuthController` - 24 edges
10. `money()` - 24 edges

## Surprising Connections (you probably didn't know these)

- `injectData()` --indirect_call--> `row()` [INFERRED]
  apps/api/src/prisma/tenant-guard.extension.ts → packages/shared/src/collections.spec.ts
- `buildWorkbook()` --indirect_call--> `row()` [INFERRED]
  apps/api/test/imports.e2e-spec.ts → packages/shared/src/collections.spec.ts
- `NewTransactionForm()` --indirect_call--> `DocumentType` [INFERRED]
  apps/panel/src/app/panel/hareketler/page.tsx → packages/shared/src/enums.ts
- `groupByAccount()` --indirect_call--> `row()` [INFERRED]
  apps/api/src/modules/reports/reports.service.ts → packages/shared/src/collections.spec.ts
- `createTestApp()` --indirect_call--> `AppModule` [INFERRED]
  apps/api/test/setup/test-app.ts → apps/api/src/app.module.ts

## Import Cycles

- None detected.

## Communities (188 total, 88 thin omitted)

### Community 0 - "types.ts"

Cohesion: 0.07
Nodes (90): BankAccountsCard(), PosCard(), AddressesCard(), AgingCard(), BuyerDetailPage(), downloadStatementPdf(), BuyersPage(), NewBuyerForm() (+82 more)

### Community 1 - "BuyersService"

Cohesion: 0.05
Nodes (40): BuyersController, CreateBuyerDto, ListBuyersQueryDto, SELLER_SIDE, SetActiveDto, StatementQueryDto, ApiOperation, ApiTags (+32 more)

### Community 2 - "ImportsRepository"

Cohesion: 0.19
Nodes (14): ApiBody, ImportsController, ApiConsumes, ApiOperation, ApiTags, Body, Controller, CurrentUser (+6 more)

### Community 3 - "pdf.service.ts"

Cohesion: 0.05
Nodes (41): LedgerModule, Module, StatementLine, cell(), createPdfMake(), head(), PdfMake, PdfService (+33 more)

### Community 4 - "ana-sayfa.tsx"

Cohesion: 0.07
Nodes (41): Dashboard, HomeScreen(), MeResponse, RiskBucket(), RiskSummary, styles, fromDate(), RANGES (+33 more)

### Community 5 - ".log"

Cohesion: 0.08
Nodes (22): BankAccountDto, PosConfigDto, SellersController, TotpQueryDto, ApiOperation, ApiTags, Body, Controller (+14 more)

### Community 6 - "CollectionsController"

Cohesion: 0.22
Nodes (14): CollectionsController, ApiOperation, ApiTags, Body, Controller, CurrentUser, Get, Param (+6 more)

### Community 7 - "compilerOptions"

Cohesion: 0.04
Nodes (44): compilerOptions, baseUrl, outDir, paths, rootDir, types, exclude, extends (+36 more)

### Community 8 - "money.ts"

Cohesion: 0.19
Nodes (25): add(), applyRate(), computeBalance(), computeRunningBalances(), currencyCodeSchema, div(), eq(), formatMoney() (+17 more)

### Community 9 - "statement.service.ts"

Cohesion: 0.08
Nodes (18): AuditService, Inject, Injectable, StorageModule, Global, Module, StorageService, Injectable (+10 more)

### Community 10 - "RepresentativesController"

Cohesion: 0.08
Nodes (20): CreateRepresentativeDto, RepresentativesController, ApiOperation, ApiTags, Body, Controller, Delete, Get (+12 more)

### Community 11 - "PrismaService"

Cohesion: 0.10
Nodes (20): AuditEntry, jsonReplacer(), toJson(), TenantContextMiddleware, Injectable, EMPTY, storage, TenantContext (+12 more)

### Community 12 - "index.ts"

Cohesion: 0.07
Nodes (16): CurrentUser, Public(), JwtAuthGuard, Injectable, RolesGuard, Injectable, TenantGuard, Injectable (+8 more)

### Community 13 - "sandbox-pos.adapter.ts"

Cohesion: 0.11
Nodes (17): CardPosProvider, readOrderId(), Injectable, HostedPaymentRequest, HostedPaymentStart, InstallmentOption, PosAdapter, PosCallbackResult (+9 more)

### Community 14 - "package.json"

Cohesion: 0.06
Nodes (34): default, dependencies, decimal.js, zod, devDependencies, @carinet/config, eslint, rimraf (+26 more)

### Community 15 - "AuthController"

Cohesion: 0.19
Nodes (16): AuthController, ApiOperation, ApiTags, Body, Controller, CurrentUser, Get, Post (+8 more)

### Community 16 - "CLAUDE.md — CariNet · B2B Cari Hesap Platformu (Ana Beyin)"

Cohesion: 0.06
Nodes (32): 0. Kimlik ve Kapsam, 10. API Sözleşmesi, 11. Güvenlik (8 katman — Faz 5'in release kapısı; "öneri" değil GEREKSİNİM), 12. Kodlama Standartları, 13. Geliştirme Fazları (sıralı; "bitti kriteri" sağlanmadan faz kapanmaz), 14. Yapılmayacaklar (açık yasaklar), 15. Definition of Done (her görev), 16. AI Çalışma Protokolü (Claude Code) (+24 more)

### Community 17 - "Env"

Cohesion: 0.14
Nodes (12): Env, envSchema, validateEnv(), AuthModule, Module, OPTIONS, fromCookie(), JwtStrategy (+4 more)

### Community 18 - "AddressesService"

Cohesion: 0.10
Nodes (19): AddressesController, CreateAddressDto, ListQueryDto, ApiOperation, ApiTags, Body, Controller, CurrentUser (+11 more)

### Community 19 - "collections.module.ts"

Cohesion: 0.13
Nodes (21): IntentRow, CreatePendingIntent, IntentFactory, Injectable, BankTransferProvider, Injectable, CardPaymentStart, orderIdSchema (+13 more)

### Community 20 - "package.json"

Cohesion: 0.06
Nodes (31): husky, lint-staged, devDependencies, @carinet/config, husky, lint-staged, prettier, turbo (+23 more)

### Community 21 - "AuthRepository"

Cohesion: 0.06
Nodes (15): AuthRepository, Inject, Injectable, AuthService, sha256(), Injectable, TWO_FA_ROLES, PasswordService (+7 more)

### Community 22 - "TxClient"

Cohesion: 0.11
Nodes (8): CollectionsRepository, Inject, Injectable, IntentExpiryTask, Injectable, randomSuffix(), describe(), Cron

### Community 23 - "exports"

Cohesion: 0.07
Nodes (26): eslint-config-prettier, @eslint/js, globals, dependencies, eslint-config-prettier, @eslint/js, globals, typescript-eslint (+18 more)

### Community 24 - "InvoicesRepository"

Cohesion: 0.10
Nodes (15): CancelInvoiceDto, CreateInvoiceDto, ListInvoicesQueryDto, InvoicesRepository, Inject, Injectable, BuyerRef, InvoicesService (+7 more)

### Community 25 - "TransactionsRepository"

Cohesion: 0.12
Nodes (12): CancelTransactionDto, CreateTransactionDto, ListTransactionsQueryDto, TransactionsRepository, Inject, Injectable, toIsoDate(), toTransactionDto() (+4 more)

### Community 26 - "auth.ts"

Cohesion: 0.09
Nodes (23): userRoleSchema, AcceptInviteInput, acceptInviteSchema, AuthenticatedUser, AuthTokens, CreateInviteInput, createInviteSchema, emailSchema (+15 more)

### Community 27 - "app.module.ts"

Cohesion: 0.16
Nodes (13): AuditModule, Global, Module, BuyersModule, Module, CollectionsModule, Module, InvoicesModule (+5 more)

### Community 28 - "collections.ts"

Cohesion: 0.09
Nodes (21): BankAccountInput, bankAccountSchema, BankStatementRowInput, bankStatementRowSchema, BulkConfirmInput, bulkConfirmSchema, CancelIntentInput, cancelIntentSchema (+13 more)

### Community 29 - "imports.ts"

Cohesion: 0.10
Nodes (20): BuyerAccountRow, buyerAccountRowSchema, CancelImportInput, cancelImportSchema, columnMappingSchema, CommitImportInput, commitImportSchema, ImportRowsQuery (+12 more)

### Community 30 - "globalEnv"

Cohesion: 0.10
Nodes (21): DATABASE_URL, EXPO_PUBLIC_API_URL, JWT_ACCESS_SECRET, JWT_ACCESS_TTL, JWT_REFRESH_SECRET, JWT_REFRESH_TTL, MAIL_FROM, MASTER_ENCRYPTION_KEY (+13 more)

### Community 31 - "compilerOptions"

Cohesion: 0.10
Nodes (19): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module (+11 more)

### Community 32 - "invoices.ts"

Cohesion: 0.15
Nodes (16): computeInvoiceTotals(), computeLineTotals(), InvoiceLineInput, InvoiceLineTotals, InvoiceTotals, quantitySchema, taxRateSchema, CancelInvoiceInput (+8 more)

### Community 33 - "TenantContext"

Cohesion: 0.13
Nodes (3): CollectionsService, toIntentDto(), Injectable

### Community 34 - "compilerOptions"

Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, declaration, declarationMap, incremental, jsx, lib, module (+9 more)

### Community 35 - "test-app.ts"

Cohesion: 0.18
Nodes (11): AppModule, Module, loadSchemaObjectFactory(), SchemaObjectFactoryClass, setupSwagger(), bootstrap(), createTestApp(), decodeJwt() (+3 more)

### Community 36 - "AuthService"

Cohesion: 0.16
Nodes (18): TransactionType, BalanceMovement, AGING_BUCKETS, AgingBucket, AgingReport, AverageDue, bucketOf(), byAgeAsc() (+10 more)

### Community 37 - "dependencies"

Cohesion: 0.12
Nodes (17): dependencies, @carinet/shared, expo-clipboard, expo-file-system, expo-linking, expo-secure-store, react-dom, react-native-svg (+9 more)

### Community 38 - "tsconfig.json"

Cohesion: 0.12
Nodes (16): compilerOptions, baseUrl, noUncheckedIndexedAccess, paths, strict, exclude, extends, include (+8 more)

### Community 39 - "dependencies"

Cohesion: 0.12
Nodes (17): dependencies, @carinet/shared, class-variance-authority, clsx, lucide-react, @radix-ui/react-select, tailwind-merge, @tanstack/react-query (+9 more)

### Community 40 - "devDependencies"

Cohesion: 0.12
Nodes (17): devDependencies, @carinet/config, eslint, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+9 more)

### Community 41 - "collections.ts"

Cohesion: 0.20
Nodes (15): AccountCodeRef, amountVerdict(), buildReferenceCode(), isValidIban(), MatchConfidence, matchStatementRows(), normalizeIban(), normalizeReference() (+7 more)

### Community 42 - "enums.ts"

Cohesion: 0.08
Nodes (26): CollectChannel, collectChannelSchema, DocumentType, documentTypeSchema, ImportRowStatus, importRowStatusSchema, ImportSourceType, importSourceTypeSchema (+18 more)

### Community 43 - "InvoicesController"

Cohesion: 0.22
Nodes (11): InvoicesController, ApiOperation, ApiTags, Body, Controller, CurrentUser, Get, Param (+3 more)

### Community 44 - "TransactionsController"

Cohesion: 0.22
Nodes (11): TransactionsController, ApiOperation, ApiTags, Body, Controller, CurrentUser, Get, Param (+3 more)

### Community 45 - "expo"

Cohesion: 0.12
Nodes (15): package, typedRoutes, expo, android, experiments, ios, name, newArchEnabled (+7 more)

### Community 46 - "devDependencies"

Cohesion: 0.13
Nodes (15): devDependencies, @carinet/config, dotenv, eslint, @nestjs/cli, pino-pretty, @types/express, @types/nodemailer (+7 more)

### Community 47 - "scripts"

Cohesion: 0.14
Nodes (14): scripts, build, db:deploy, db:generate, db:migrate, db:reset, db:seed, db:studio (+6 more)

### Community 49 - "exclude"

Cohesion: 0.14
Nodes (13): compilerOptions, outDir, rootDir, exclude, extends, include, dist, node_modules (+5 more)

### Community 50 - "compilerOptions"

Cohesion: 0.14
Nodes (13): compilerOptions, emitDecoratorMetadata, experimentalDecorators, isolatedModules, lib, module, moduleResolution, strictPropertyInitialization (+5 more)

### Community 51 - "dependencies"

Cohesion: 0.15
Nodes (13): adm-zip, dependencies, adm-zip, exceljs, nestjs-pino, @nestjs/platform-express, passport, pino-http (+5 more)

### Community 52 - "ubl.parser.ts"

Cohesion: 0.38
Nodes (10): asArray(), attr(), isNode(), Node, partyIdentifier(), pick(), sumStrings(), text() (+2 more)

### Community 53 - "scripts"

Cohesion: 0.15
Nodes (12): main, name, private, scripts, android, build, dev, ios (+4 more)

### Community 54 - "import.spec.ts"

Cohesion: 0.14
Nodes (20): ImportTarget, atUtcMidnight(), cellToDate(), cellToMoney(), cellToRate(), cellToText(), CellValue, EXCEL_EPOCH_UTC (+12 more)

### Community 55 - "index.ts"

Cohesion: 0.15
Nodes (9): AppError, AppErrorDetails, ERROR_MESSAGES, ErrorCode, HTTP_STATUS_BY_ERROR_CODE, CreateAddressInput, createAddressSchema, UpdateAddressInput (+1 more)

### Community 56 - "buyers.ts"

Cohesion: 0.15
Nodes (12): accountCodeSchema, BuyerListQuery, buyerListQuerySchema, CreateBuyerAccountInput, createBuyerAccountSchema, CreateRepresentativeInput, createRepresentativeSchema, UpdateBuyerAccountInput (+4 more)

### Community 57 - "2026-07-13 · Faz 0 — Iskelet ve Temel"

Cohesion: 0.21
Nodes (12): 2026-07-13 · Faz 0 — Iskelet ve Temel, 2026-07-14 · Faz 1 — Cekirdek MVP, Bitti kriteri kontrolu (Faz 0), Bitti kriteri kontrolu (Faz 1), CLAUDE.md ile UYUSMAZLIK (§16.4 — bildiriliyor, onaysiz kural degistirilmedi), CLAUDE.md ile UYUSMAZLIK → **COZULDU (kullanici onayi, 14.07.2026)**, Kararlar, PROGRESS.md — CariNet AI Calisma Gunlugu (+4 more)

### Community 58 - "base.js"

Cohesion: 0.27
Nodes (4): base, nest, next, reactNative

### Community 59 - "tasks"

Cohesion: 0.21
Nodes (12): ^build, coverage/**, dependsOn, dependsOn, tasks, build, lint, test (+4 more)

### Community 60 - "devDependencies"

Cohesion: 0.18
Nodes (11): devDependencies, @carinet/config, eslint, @types/node, @types/react, typescript, @carinet/config, eslint (+3 more)

### Community 61 - "scripts"

Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, lint, start, test (+2 more)

### Community 62 - "import-cells.ts"

Cohesion: 0.17
Nodes (7): assertFile(), formatIssues(), readCutoff(), ROW_SCHEMA, StagedRow, summarize(), toJson()

### Community 63 - "common.ts"

Cohesion: 0.18
Nodes (9): ApiFailure, ApiResponse, ApiSuccess, cuidSchema, DateRangeQuery, dateRangeQuerySchema, PaginationMeta, PaginationQuery (+1 more)

### Community 64 - "tenant-guard.extension.ts"

Cohesion: 0.29
Nodes (9): Args, CREATE_OPS, injectData(), injectWhere(), isPlainObject(), TENANT_MODELS, tenantForbidden(), tenantGuardExtension (+1 more)

### Community 65 - "transactions.ts"

Cohesion: 0.13
Nodes (14): 10. Sik karsilasilan sorunlar, 11. "pnpm taninmiyor" — kullanici PATH'i sismis, 1. Servisler (Postgres + Mailpit + MinIO), 2. Veritabani (yalniz ilk kez veya sifirlamak isteyince), 3. Uygulamalari baslat, 4. Test hesaplari, 5. Mobil (Expo), 6. Neye bakmali (Faz 1-3) (+6 more)

### Community 66 - "seed.ts"

Cohesion: 0.36
Nodes (7): @prisma/client, day(), main(), prisma, referenceCode(), reset(), @prisma/client

### Community 67 - "Paginated"

Cohesion: 0.29
Nodes (3): Paginated, ResponseInterceptor, Injectable

### Community 68 - "auth.dto.ts"

Cohesion: 0.25
Nodes (7): AcceptInviteDto, CreateInviteDto, ForgotPasswordDto, LoginDto, RefreshDto, ResetPasswordDto, SwitchAccountDto

### Community 69 - "exclude"

Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/_.spec.ts, ./tsconfig.json, \**/_.test.ts

### Community 70 - "nest-cli.json"

Cohesion: 0.29
Nodes (6): collection, compilerOptions, deleteOutDir, tsConfigPath, $schema, sourceRoot

### Community 71 - "encryption.ts"

Cohesion: 0.52
Nodes (5): decryptSecret(), encryptSecret(), maskSecret(), KEY, toKey()

### Community 72 - "AllExceptionsFilter"

Cohesion: 0.38
Nodes (3): AllExceptionsFilter, HTTP_TO_CODE, Catch

### Community 73 - "package.json"

Cohesion: 0.33
Nodes (5): name, prisma, seed, private, version

### Community 74 - ".constructor"

Cohesion: 0.18
Nodes (5): decorate(), isConfirmed(), StatementService, toRowView(), Injectable

### Community 75 - "PrismaModule"

Cohesion: 0.33
Nodes (4): PrismaModule, Global, Inject, Module

### Community 76 - "outputs"

Cohesion: 0.33
Nodes (5): config, .next/**, !.next/cache/**, outputs, dist/**

### Community 77 - "metro.config.js"

Cohesion: 0.40
Nodes (4): config, { getDefaultConfig }, path, workspaceRoot

### Community 79 - "post-commit"

Cohesion: 0.40
Nodes (4): GRAPHIFY_CHANGED, GRAPHIFY_REBUILD_LOG, post-commit script, PYTHONHASHSEED

### Community 80 - "row"

Cohesion: 0.29
Nodes (4): ImportsRepository, Inject, Injectable, TxClient

### Community 81 - "post-checkout"

Cohesion: 0.50
Nodes (3): GRAPHIFY_REBUILD_LOG, post-checkout script, PYTHONHASHSEED

### Community 82 - "turbo.json"

Cohesion: 0.50
Nodes (3): .env, globalDependencies, $schema

### Community 83 - "dev"

Cohesion: 0.67
Nodes (3): cache, persistent, dev

### Community 185 - "collections.controller.ts"

Cohesion: 0.22
Nodes (8): BulkConfirmDto, CancelIntentDto, ConfirmIntentDto, CreateIntentDto, GuestIntentDto, InstallmentDto, IntentListDto, SELLER

### Community 186 - "imports.controller.ts"

Cohesion: 0.22
Nodes (8): BatchesQueryDto, CancelDto, CommitDto, filePipe, ReportQueryDto, RowsQueryDto, SaveTemplateDto, UploadDto

### Community 187 - ".import"

Cohesion: 0.29
Nodes (4): ApiConsumes, UseInterceptors, incomingAmount(), UploadedFile

## Knowledge Gaps

- **660 isolated node(s):** `1. Servisler (Postgres + Mailpit + MinIO)`, `2. Veritabani (yalniz ilk kez veya sifirlamak isteyince)`, `3. Uygulamalari baslat`, `4. Test hesaplari`, `5. Mobil (Expo)` (+655 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **88 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `StatementCard()` connect `types.ts` to `.constructor`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `row()` connect `pdf.service.ts` to `tenant-guard.extension.ts`, `BuyersService`, `collections.ts`, `.constructor`, `InvoicesRepository`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `PrismaService` connect `PrismaService` to `BuyersService`, `pdf.service.ts`, `.log`, `statement.service.ts`, `RepresentativesController`, `PrismaModule`, `index.ts`, `row`, `Env`, `TokenService`, `collections.module.ts`, `AuthRepository`, `TxClient`, `InvoicesRepository`, `TransactionsRepository`, `import-cells.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `1. Servisler (Postgres + Mailpit + MinIO)`, `2. Veritabani (yalniz ilk kez veya sifirlamak isteyince)`, `3. Uygulamalari baslat` to the rest of the system?**
  _660 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07185354691075514 - nodes in this community are weakly interconnected._
- **Should `BuyersService` be split into smaller, more focused modules?**
  _Cohesion score 0.05209274314965372 - nodes in this community are weakly interconnected._
- **Should `pdf.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0502283105022831 - nodes in this community are weakly interconnected._
