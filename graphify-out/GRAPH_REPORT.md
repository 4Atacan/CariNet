# Graph Report - CariNet (2026-07-17)

## Corpus Check

- 259 files · ~103,231 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 2583 nodes · 4528 edges · 248 communities (145 shown, 103 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.61)
- Token cost: 0 input · 0 output

## Graph Freshness

- Built from commit: `ea19002e`
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
- global-setup.ts
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
- page.tsx
- index.js
- ApiConsumes
- ApiOperation
- ApiTags
- buyers.e2e-spec.ts
- collections.e2e-spec.ts
- invoices.e2e-spec.ts
- env.ts
- tenant-isolation.e2e-spec.ts
- transactions.e2e-spec.ts
- vitest.config.ts
- vitest.e2e.config.ts
- babel.config.js
- postcss.config.mjs
- Body
- Controller
- CurrentUser
- Delete
- Get
- Global
- vitest.config.ts
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
- RequestsService
- NotificationsController
- RequestsController
- ana-sayfa.tsx
- TokenService
- ExportsService
- pdf.service.ts
- CampaignsService
- app.module.ts
- reminders.ts
- ApiTags
- transactions.ts
- import-mapping.ts
- HealthController
- 2fa.e2e-spec.ts
- due-reminder.task.ts
- products.controller.ts
- expo-clipboard
- expo-device
- expo-linking
- expo-notifications
- react-dom
- react-native-svg
- Inject
- Res
- Roles
- UseInterceptors
- 2026-07-14 · Faz 4 — Katalog ve Iletisim (§13)
- products.controller.ts
- 2026-07-13 · Faz 0 — Iskelet ve Temel
- 2026-07-15 · Faz 5 — Sertlestirme ve Yayin (§11, §13)
- 2026-07-14 · Faz 2 — Finansal Raporlar
- 2026-07-17 · Faz 5 — Sentry ×3 kod tarafi (§11.8)
- PROGRESS.md — CariNet AI Calisma Gunlugu
- cookie-parser
- @types/multer
- @babel/runtime
- next
- 2026-07-13 · Faz 0 — Iskelet ve Temel
- 2026-07-14 · Faz 1 — Cekirdek MVP
- 2026-07-15 · Faz 5 — Sertlestirme ve Yayin (§11, §13)
- 2026-07-17 · Faz 5 — Yuk testi + ekstre sorgusu yeniden kuruldu (§6.4, §13 yuk hedefi)
- 2026-07-17 · Faz 5 — Sentry ×3 kod tarafi (§11.8)
- @babel/runtime

## God Nodes (most connected - your core abstractions)

1. `TxClient` - 43 edges
2. `CollectionsRepository` - 39 edges
3. `AuthRepository` - 39 edges
4. `PrismaService` - 36 edges
5. `AuthController` - 28 edges
6. `AuthService` - 28 edges
7. `ImportsRepository` - 25 edges
8. `AuditService` - 23 edges
9. `Env` - 23 edges
10. `TenantContext` - 22 edges

## Surprising Connections (you probably didn't know these)

- `buildWorkbook()` --indirect_call--> `row()` [INFERRED]
  apps/api/test/imports.e2e-spec.ts → packages/shared/src/collections.spec.ts
- `NewTransactionForm()` --indirect_call--> `DocumentType` [INFERRED]
  apps/panel/src/app/panel/hareketler/page.tsx → packages/shared/src/enums.ts
- `groupByAccount()` --indirect_call--> `row()` [INFERRED]
  apps/api/src/modules/reports/reports.service.ts → packages/shared/src/collections.spec.ts
- `Result()` --calls--> `money()` [EXTRACTED]
  apps/mobile/app/odeme.tsx → apps/mobile/src/lib/format.ts
- `PaymentInstructions()` --calls--> `money()` [EXTRACTED]
  apps/panel/src/app/pay/[sellerSlug]/page.tsx → apps/panel/src/lib/utils.ts

## Import Cycles

- None detected.

## Communities (248 total, 103 thin omitted)

### Community 0 - "types.ts"

Cohesion: 0.15
Nodes (9): ProductsRepository, Inject, Injectable, ProductDto, ProductsService, ProductWithStock, toProductDto(), Inject (+1 more)

### Community 1 - "BuyersService"

Cohesion: 0.11
Nodes (23): ApiBody, BatchesQueryDto, CancelDto, CommitDto, filePipe, ImportsController, ReportQueryDto, RowsQueryDto (+15 more)

### Community 2 - "ImportsRepository"

Cohesion: 0.07
Nodes (26): CollectionsModule, Module, BankAccountDto, PosConfigDto, SellersController, TotpQueryDto, ApiOperation, ApiTags (+18 more)

### Community 3 - "pdf.service.ts"

Cohesion: 0.14
Nodes (3): AuthService, sha256(), Injectable

### Community 4 - "ana-sayfa.tsx"

Cohesion: 0.10
Nodes (7): ImportsRepository, Injectable, ImportsService, readCutoff(), Inject, Injectable, TxClient

### Community 5 - ".log"

Cohesion: 0.06
Nodes (37): BuyerDetailPage(), downloadStatementPdf(), BuyersPage(), Periodic, ReportsPage(), RiskRow, TONE, ProductsPage() (+29 more)

### Community 6 - "CollectionsController"

Cohesion: 0.04
Nodes (44): compilerOptions, baseUrl, outDir, paths, rootDir, types, exclude, extends (+36 more)

### Community 7 - "compilerOptions"

Cohesion: 0.09
Nodes (43): TransactionType, add(), applyRate(), BalanceMovement, computeBalance(), computeRunningBalances(), currencyCodeSchema, div() (+35 more)

### Community 8 - "money.ts"

Cohesion: 0.05
Nodes (37): StatementLine, cell(), createPdfMake(), head(), PdfMake, PdfService, req, StatementPdfInput (+29 more)

### Community 9 - "statement.service.ts"

Cohesion: 0.06
Nodes (33): userRoleSchema, AcceptInviteInput, acceptInviteSchema, AuthenticatedUser, AuthTokens, CreateInviteInput, createInviteSchema, DeleteAccountInput (+25 more)

### Community 10 - "RepresentativesController"

Cohesion: 0.09
Nodes (15): CollectionsRepository, Injectable, IntentExpiryTask, Injectable, CreatePendingIntent, IntentFactory, randomSuffix(), Injectable (+7 more)

### Community 11 - "PrismaService"

Cohesion: 0.08
Nodes (20): CreateRepresentativeDto, RepresentativesController, ApiOperation, ApiTags, Body, Controller, Delete, Get (+12 more)

### Community 12 - "index.ts"

Cohesion: 0.19
Nodes (18): AuthController, ApiOperation, ApiTags, Body, Controller, CurrentUser, Delete, Get (+10 more)

### Community 13 - "sandbox-pos.adapter.ts"

Cohesion: 0.09
Nodes (23): ExchangeRatesController, RateQueryDto, ApiOperation, ApiTags, Controller, Get, NoTenant, Post (+15 more)

### Community 14 - "package.json"

Cohesion: 0.06
Nodes (34): default, dependencies, decimal.js, zod, devDependencies, @carinet/config, eslint, rimraf (+26 more)

### Community 15 - "AuthController"

Cohesion: 0.06
Nodes (33): AnnounceCampaignInput, announceCampaignSchema, CampaignListQuery, campaignListQuerySchema, CreateCampaignInput, createCampaignSchema, CreateProductInput, createProductSchema (+25 more)

### Community 16 - "CLAUDE.md — CariNet · B2B Cari Hesap Platformu (Ana Beyin)"

Cohesion: 0.12
Nodes (12): CancelTransactionDto, CreateTransactionDto, ListTransactionsQueryDto, TransactionsRepository, Inject, Injectable, toIsoDate(), toTransactionDto() (+4 more)

### Community 17 - "Env"

Cohesion: 0.06
Nodes (35): 0. Kimlik ve Kapsam, 10. API Sözleşmesi, 11. Güvenlik (8 katman — Faz 5'in release kapısı; "öneri" değil GEREKSİNİM), 12. Kodlama Standartları, 13. Geliştirme Fazları (sıralı; "bitti kriteri" sağlanmadan faz kapanmaz), 14. Yapılmayacaklar (açık yasaklar), 15. Definition of Done (her görev), 16. AI Çalışma Protokolü (Claude Code) (+27 more)

### Community 18 - "AddressesService"

Cohesion: 0.09
Nodes (20): AddressesController, CreateAddressDto, ListQueryDto, ApiOperation, ApiTags, Body, Controller, CurrentUser (+12 more)

### Community 19 - "collections.module.ts"

Cohesion: 0.06
Nodes (31): husky, lint-staged, devDependencies, @carinet/config, husky, lint-staged, prettier, turbo (+23 more)

### Community 20 - "package.json"

Cohesion: 0.09
Nodes (7): Inject, Inject, NotificationsRepository, Inject, Injectable, NotificationsService, Injectable

### Community 21 - "AuthRepository"

Cohesion: 0.19
Nodes (12): HostedPaymentRequest, HostedPaymentStart, InstallmentOption, PosAdapter, PosCallbackResult, PosCredentials, callbackSchema, INSTALLMENT_TABLE (+4 more)

### Community 22 - "TxClient"

Cohesion: 0.11
Nodes (11): AuditService, Injectable, StorageService, Injectable, Env, envSchema, IntentRow, MailModule (+3 more)

### Community 23 - "exports"

Cohesion: 0.22
Nodes (11): RequestsController, ApiOperation, ApiTags, Body, Controller, CurrentUser, Get, Param (+3 more)

### Community 24 - "InvoicesRepository"

Cohesion: 0.08
Nodes (25): AuditEntry, jsonReplacer(), toJson(), Inject, Public(), REPRESENTATIVE_SELECT, Inject, HealthController (+17 more)

### Community 25 - "TransactionsRepository"

Cohesion: 0.15
Nodes (6): BuyersRepository, Inject, Injectable, BuyersService, toBuyerDto(), Injectable

### Community 26 - "auth.ts"

Cohesion: 0.19
Nodes (16): CollectionsController, ApiConsumes, ApiOperation, ApiTags, Body, Controller, CurrentUser, Get (+8 more)

### Community 27 - "app.module.ts"

Cohesion: 0.13
Nodes (9): InvoicesRepository, Inject, Injectable, InvoicesService, toInvoiceDto(), toInvoiceSummary(), toIsoDate(), Inject (+1 more)

### Community 28 - "collections.ts"

Cohesion: 0.19
Nodes (22): EMPTY_ITEM, InvoiceFormValues, NewInvoiceForm(), safeTotals(), NewTransactionForm(), GuestIntentResult, PaymentInstructions(), PublicSeller (+14 more)

### Community 29 - "imports.ts"

Cohesion: 0.07
Nodes (27): CollectChannel, DocumentType, documentTypeSchema, ImportRowStatus, importRowStatusSchema, ImportSourceType, ImportStatus, importStatusSchema (+19 more)

### Community 30 - "globalEnv"

Cohesion: 0.15
Nodes (13): BankTransferProvider, Injectable, CardPaymentStart, orderIdSchema, readOrderId(), CollectIntentInput, CollectIntentView, CollectionProvider (+5 more)

### Community 31 - "compilerOptions"

Cohesion: 0.07
Nodes (26): eslint-config-prettier, @eslint/js, globals, dependencies, eslint-config-prettier, @eslint/js, globals, typescript-eslint (+18 more)

### Community 32 - "invoices.ts"

Cohesion: 0.25
Nodes (7): 2026-07-14 · Faz 2 — Finansal Raporlar, Bitti kriteri kontrolu (Faz 2), Kararlar, PROGRESS.md — CariNet AI Calisma Gunlugu, Sablon (her blok icin), Sonraki adim, Yapilan

### Community 33 - "TenantContext"

Cohesion: 0.09
Nodes (12): CurrentUser, JwtAuthGuard, Injectable, RolesGuard, Injectable, TenantGuard, Injectable, RequestUser (+4 more)

### Community 34 - "compilerOptions"

Cohesion: 0.06
Nodes (38): AccountCodeRef, amountVerdict(), buildReferenceCode(), isValidIban(), MatchConfidence, matchStatementRows(), normalizeIban(), normalizeReference() (+30 more)

### Community 35 - "test-app.ts"

Cohesion: 0.14
Nodes (20): ImportTarget, atUtcMidnight(), cellToDate(), cellToMoney(), cellToRate(), cellToText(), CellValue, EXCEL_EPOCH_UTC (+12 more)

### Community 36 - "AuthService"

Cohesion: 0.13
Nodes (16): validateEnv(), loggerOptions(), AuthModule, Module, CampaignsModule, Module, ExchangeRatesModule, Module (+8 more)

### Community 37 - "dependencies"

Cohesion: 0.12
Nodes (16): LedgerModule, Module, BalanceRawRow, LedgerRepository, SIGNED_TRY, SIGNED_TRY_PAGE, StatementFilter, StatementRawRow (+8 more)

### Community 38 - "tsconfig.json"

Cohesion: 0.13
Nodes (11): TWO_FA_ROLES, UserRecord, BreachedPasswordService, hibpHashParts(), suffixInRange(), Injectable, hashBackupCode(), normalizeBackupCode() (+3 more)

### Community 39 - "dependencies"

Cohesion: 0.21
Nodes (19): InvoicesPage(), WizardPage(), TransactionsPage(), formatError(), ImportsPage(), PanelHomePage(), BulkMatch, CollectionsPage() (+11 more)

### Community 40 - "devDependencies"

Cohesion: 0.10
Nodes (21): importSourceTypeSchema, BuyerAccountRow, buyerAccountRowSchema, CancelImportInput, cancelImportSchema, columnMappingSchema, CommitImportInput, commitImportSchema (+13 more)

### Community 41 - "collections.ts"

Cohesion: 0.14
Nodes (7): TenantContextMiddleware, Injectable, EMPTY, storage, TenantContext, TenantStore, Cron

### Community 42 - "enums.ts"

Cohesion: 0.23
Nodes (12): BuyersController, ApiOperation, ApiTags, Body, Controller, CurrentUser, Get, Param (+4 more)

### Community 43 - "InvoicesController"

Cohesion: 0.10
Nodes (21): DATABASE_URL, EXPO_PUBLIC_API_URL, JWT_ACCESS_SECRET, JWT_ACCESS_TTL, JWT_REFRESH_SECRET, JWT_REFRESH_TTL, MAIL_FROM, MASTER_ENCRYPTION_KEY (+13 more)

### Community 44 - "TransactionsController"

Cohesion: 0.10
Nodes (19): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module (+11 more)

### Community 45 - "expo"

Cohesion: 0.18
Nodes (3): CollectionsService, toIntentDto(), Injectable

### Community 46 - "devDependencies"

Cohesion: 0.19
Nodes (12): fromDate(), RANGES, StatementLine, StatementScreen(), styles, InvoiceDetail, InvoiceScreen(), styles (+4 more)

### Community 47 - "scripts"

Cohesion: 0.24
Nodes (12): BankAccountsCard(), PosCard(), RepresentativesPage(), GuestPayPage(), api(), apiDelete(), ApiError, apiGet() (+4 more)

### Community 48 - "TokenService"

Cohesion: 0.15
Nodes (16): computeInvoiceTotals(), computeLineTotals(), InvoiceLineInput, InvoiceLineTotals, InvoiceTotals, quantitySchema, taxRateSchema, CancelInvoiceInput (+8 more)

### Community 49 - "exclude"

Cohesion: 0.17
Nodes (12): CampaignsController, ApiOperation, ApiTags, Body, Controller, CurrentUser, Delete, Get (+4 more)

### Community 50 - "compilerOptions"

Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, declaration, declarationMap, incremental, jsx, lib, module (+9 more)

### Community 51 - "dependencies"

Cohesion: 0.21
Nodes (11): NotificationsController, ApiOperation, ApiTags, Body, Controller, CurrentUser, Delete, Get (+3 more)

### Community 52 - "ubl.parser.ts"

Cohesion: 0.14
Nodes (14): Notification, NotificationsScreen(), NotificationType, styles, RequestsScreen(), RequestStatus, RequestType, styles (+6 more)

### Community 53 - "scripts"

Cohesion: 0.12
Nodes (17): dependencies, @carinet/shared, expo, expo-clipboard, expo-file-system, react-dom, react-native-gifted-charts, @sentry/react-native (+9 more)

### Community 54 - "import.spec.ts"

Cohesion: 0.12
Nodes (16): compilerOptions, baseUrl, noUncheckedIndexedAccess, paths, strict, exclude, extends, include (+8 more)

### Community 55 - "index.ts"

Cohesion: 0.12
Nodes (17): dependencies, @carinet/shared, class-variance-authority, @radix-ui/react-dialog, react, react-hook-form, @sentry/nextjs, @tanstack/react-query (+9 more)

### Community 56 - "buyers.ts"

Cohesion: 0.12
Nodes (17): devDependencies, @carinet/config, eslint, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+9 more)

### Community 57 - "2026-07-13 · Faz 0 — Iskelet ve Temel"

Cohesion: 0.33
Nodes (10): asArray(), attr(), isNode(), Node, partyIdentifier(), pick(), sumStrings(), text() (+2 more)

### Community 58 - "base.js"

Cohesion: 0.16
Nodes (5): ClientMeta, RefreshPayload, sha256(), TokenService, Injectable

### Community 59 - "tasks"

Cohesion: 0.22
Nodes (11): InvoicesController, ApiOperation, ApiTags, Body, Controller, CurrentUser, Get, Param (+3 more)

### Community 60 - "devDependencies"

Cohesion: 0.22
Nodes (11): TransactionsController, ApiOperation, ApiTags, Body, Controller, CurrentUser, Get, Param (+3 more)

### Community 61 - "scripts"

Cohesion: 0.12
Nodes (15): package, typedRoutes, expo, android, experiments, ios, name, newArchEnabled (+7 more)

### Community 62 - "import-cells.ts"

Cohesion: 0.13
Nodes (15): devDependencies, @carinet/config, eslint, pino-pretty, prisma, @types/adm-zip, @types/express, @types/nodemailer (+7 more)

### Community 63 - "common.ts"

Cohesion: 0.50
Nodes (3): AuditModule, Global, Module

### Community 64 - "tenant-guard.extension.ts"

Cohesion: 0.22
Nodes (4): assertFile(), formatIssues(), summarize(), toJson()

### Community 65 - "transactions.ts"

Cohesion: 0.14
Nodes (12): MarkReadDto, NotificationListDto, RegisterTokenDto, NotificationsModule, Module, NotifyInput, ExpoTicket, PushMessage (+4 more)

### Community 66 - "seed.ts"

Cohesion: 0.17
Nodes (5): Me, NAV, tr, Campaign, ExchangeRate

### Community 67 - "Paginated"

Cohesion: 0.13
Nodes (14): 10. Sik karsilasilan sorunlar, 11. "pnpm taninmiyor" — kullanici PATH'i sismis, 1. Servisler (Postgres + Mailpit + MinIO), 2. Veritabani (yalniz ilk kez veya sifirlamak isteyince), 3. Uygulamalari baslat, 4. Test hesaplari, 5. Mobil (Expo), 6. Neye bakmali (Faz 1-3) (+6 more)

### Community 68 - "auth.dto.ts"

Cohesion: 0.16
Nodes (15): ^build, coverage/**, dependsOn, cache, persistent, dependsOn, tasks, build (+7 more)

### Community 69 - "exclude"

Cohesion: 0.14
Nodes (14): scripts, build, db:deploy, db:generate, db:migrate, db:reset, db:seed, db:studio (+6 more)

### Community 70 - "nest-cli.json"

Cohesion: 0.14
Nodes (13): compilerOptions, outDir, rootDir, exclude, extends, include, dist, node_modules (+5 more)

### Community 71 - "encryption.ts"

Cohesion: 0.26
Nodes (10): DeleteAccountScreen(), styles, api(), apiDelete(), apiDeleteBody(), apiPublicPost(), call(), withRefresh() (+2 more)

### Community 72 - "AllExceptionsFilter"

Cohesion: 0.14
Nodes (13): compilerOptions, emitDecoratorMetadata, experimentalDecorators, isolatedModules, lib, module, moduleResolution, strictPropertyInitialization (+5 more)

### Community 73 - "package.json"

Cohesion: 0.23
Nodes (7): AnnounceDto, CampaignListDto, CreateCampaignDto, SELLER, CampaignsService, toDto(), Injectable

### Community 74 - ".constructor"

Cohesion: 0.15
Nodes (12): accountCodeSchema, BuyerListQuery, buyerListQuerySchema, CreateBuyerAccountInput, createBuyerAccountSchema, CreateRepresentativeInput, createRepresentativeSchema, UpdateBuyerAccountInput (+4 more)

### Community 75 - "PrismaModule"

Cohesion: 0.27
Nodes (4): base, nest, next, reactNative

### Community 76 - "outputs"

Cohesion: 0.23
Nodes (6): AllExceptionsFilter, HTTP_TO_CODE, sentryEnabled, basicAuth(), bootstrap(), Catch

### Community 77 - "metro.config.js"

Cohesion: 0.32
Nodes (10): AcceptInviteDto, CreateInviteDto, DeleteAccountDto, ForgotPasswordDto, LoginDto, ResetPasswordDto, SwitchAccountDto, TwoFactorDisableDto (+2 more)

### Community 78 - "layout.tsx"

Cohesion: 0.21
Nodes (8): Dashboard, HomeScreen(), MeResponse, RiskSummary, styles, PayScreen(), apiPost(), registerForPush()

### Community 79 - "post-commit"

Cohesion: 0.27
Nodes (7): AppModule, Module, createTestApp(), decodeJwt(), rawPrisma, SeedIds, USERS

### Community 80 - "row"

Cohesion: 0.11
Nodes (3): AuthRepository, Inject, Injectable

### Community 81 - "post-checkout"

Cohesion: 0.22
Nodes (5): styles, SECTIONS, styles, ApiError, tr

### Community 82 - "turbo.json"

Cohesion: 0.18
Nodes (11): devDependencies, @carinet/config, eslint, @types/node, @types/react, typescript, @carinet/config, eslint (+3 more)

### Community 83 - "dev"

Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, lint, start, test (+2 more)

### Community 84 - "argon2"

Cohesion: 0.18
Nodes (9): ApiFailure, ApiResponse, ApiSuccess, cuidSchema, DateRangeQuery, dateRangeQuerySchema, PaginationMeta, PaginationQuery (+1 more)

### Community 85 - "@aws-sdk/client-s3"

Cohesion: 0.29
Nodes (9): Args, CREATE_OPS, injectData(), injectWhere(), isPlainObject(), TENANT_MODELS, tenantForbidden(), tenantGuardExtension (+1 more)

### Community 86 - "@carinet/shared"

Cohesion: 0.20
Nodes (7): config, metadata, SECTIONS, .next/**, !.next/cache/**, outputs, dist/**

### Community 87 - "cookie-parser"

Cohesion: 0.22
Nodes (9): adm-zip, dependencies, adm-zip, @nestjs/passport, pino, @prisma/client, @nestjs/passport, pino (+1 more)

### Community 88 - "decimal.js"

Cohesion: 0.21
Nodes (12): ProductsController, ApiOperation, ApiTags, Body, Controller, CurrentUser, Get, Param (+4 more)

### Community 89 - "fast-xml-parser"

Cohesion: 0.22
Nodes (8): BulkConfirmDto, CancelIntentDto, ConfirmIntentDto, CreateIntentDto, GuestIntentDto, InstallmentDto, IntentListDto, SELLER

### Community 90 - "helmet"

Cohesion: 0.28
Nodes (5): DueReminderTask, toIsoDate(), Cron, Inject, Injectable

### Community 91 - "@nestjs/common"

Cohesion: 0.29
Nodes (3): Paginated, ResponseInterceptor, Injectable

### Community 92 - "@nestjs/config"

Cohesion: 0.15
Nodes (12): main, name, private, scripts, android, build, dev, ios (+4 more)

### Community 93 - "@nestjs/core"

Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/_.spec.ts, ./tsconfig.json, \**/_.test.ts

### Community 94 - "@nestjs/jwt"

Cohesion: 0.29
Nodes (6): collection, compilerOptions, deleteOutDir, tsConfigPath, $schema, sourceRoot

### Community 95 - "@nestjs/passport"

Cohesion: 0.52
Nodes (5): decryptSecret(), encryptSecret(), maskSecret(), KEY, toKey()

### Community 96 - "@nestjs/schedule"

Cohesion: 0.18
Nodes (11): CreateBuyerDto, ListBuyersQueryDto, SELLER_SIDE, SetActiveDto, StatementQueryDto, UpdateBuyerDto, BuyerDto, BuyerWithBalance (+3 more)

### Community 97 - "@nestjs/swagger"

Cohesion: 0.17
Nodes (8): plugins, tokenStore, SessionState, useSession, expo-notifications, expo-router, expo-secure-store, @sentry/react-native

### Community 98 - "@nestjs/throttler"

Cohesion: 0.29
Nodes (5): Dashboard, Installment, IntentResult, Result(), styles

### Community 99 - "nestjs-zod"

Cohesion: 0.29
Nodes (5): AppError, AppErrorDetails, ERROR_MESSAGES, ErrorCode, HTTP_STATUS_BY_ERROR_CODE

### Community 100 - "nodemailer"

Cohesion: 0.33
Nodes (5): name, prisma, seed, private, version

### Community 101 - "otplib"

Cohesion: 0.53
Nodes (5): day(), main(), prisma, referenceCode(), reset()

### Community 102 - "passport-jwt"

Cohesion: 0.33
Nodes (3): OPTIONS, PasswordService, Injectable

### Community 103 - "pdfmake"

Cohesion: 0.33
Nodes (4): PrismaModule, Global, Inject, Module

### Community 105 - "reflect-metadata"

Cohesion: 0.40
Nodes (5): Campaign, CampaignsScreen(), ExchangeRate, styles, apiGet()

### Community 106 - "rxjs"

Cohesion: 0.33
Nodes (5): args, body, declined, signature, taksitIndex

### Community 107 - "zod"

Cohesion: 0.40
Nodes (4): config, { getDefaultConfig }, path, workspaceRoot

### Community 110 - "@nestjs/testing"

Cohesion: 0.40
Nodes (4): GRAPHIFY_CHANGED, GRAPHIFY_REBUILD_LOG, post-commit script, PYTHONHASHSEED

### Community 111 - "prisma"

Cohesion: 0.40
Nodes (4): CreateAddressInput, createAddressSchema, UpdateAddressInput, updateAddressSchema

### Community 112 - "supertest"

Cohesion: 0.67
Nodes (3): loadSchemaObjectFactory(), SchemaObjectFactoryClass, setupSwagger()

### Community 114 - "tsx"

Cohesion: 0.50
Nodes (3): GRAPHIFY_REBUILD_LOG, post-checkout script, PYTHONHASHSEED

### Community 115 - "@types/adm-zip"

Cohesion: 0.50
Nodes (3): .env, globalDependencies, $schema

### Community 164 - "tenant-isolation.e2e-spec.ts"

Cohesion: 0.17
Nodes (9): CreateRequestDto, ReplyRequestDto, RequestListDto, SELLER, RequestRow, RequestsService, toDto(), Inject (+1 more)

### Community 185 - "collections.controller.ts"

Cohesion: 0.30
Nodes (7): ExportDto, ExportsService, FILE_NAMES, money(), styleHeader(), text(), Injectable

### Community 235 - "2026-07-15 · Faz 5 — Sertlestirme ve Yayin (§11, §13)"

Cohesion: 0.21
Nodes (9): BuyersModule, Module, CancelInvoiceDto, CreateInvoiceDto, ListInvoicesQueryDto, InvoicesModule, Module, TransactionsModule (+1 more)

### Community 236 - "2026-07-14 · Faz 2 — Finansal Raporlar"

Cohesion: 0.26
Nodes (4): CardPosProvider, Injectable, PosRegistry, Injectable

### Community 237 - "2026-07-17 · Faz 5 — Sentry ×3 kod tarafi (§11.8)"

Cohesion: 0.25
Nodes (7): daysUntilDue(), OVERDUE_REMINDER_DAYS, REMINDER_KINDS, reminderFor(), ReminderKind, reminderText(), ASOF

### Community 238 - "PROGRESS.md — CariNet AI Calisma Gunlugu"

Cohesion: 0.20
Nodes (8): ExportsController, ApiOperation, ApiTags, Controller, CurrentUser, Get, Query, Res

### Community 239 - "cookie-parser"

Cohesion: 0.16
Nodes (11): StorageModule, Global, Module, ImportsModule, Module, CELL_READERS, detectDelimiter(), ExcelParser (+3 more)

### Community 240 - "@types/multer"

Cohesion: 0.25
Nodes (8): 2026-07-14 · Faz 3 — Tahsilat: Iki Kanal (§8), Bitti kriteri kontrolu (Faz 3), Duzeltilen hata (seed), Karar, Sema degisikligi, Sonraki adim, VARSAYIM:, Yapilan

### Community 241 - "@babel/runtime"

Cohesion: 0.25
Nodes (8): 2026-07-14 · Faz 4 — Katalog ve Iletisim (§13), Bitti kriteri kontrolu (Faz 4), Duzeltilen hatalar, Karar, Sema degisikligi, Sonraki adim, VARSAYIM:, Yapilan

### Community 242 - "next"

Cohesion: 0.29
Nodes (6): CreateProductDto, ProductListDto, SELLER, SetActiveDto, SetStockDto, UpdateProductDto

### Community 243 - "2026-07-13 · Faz 0 — Iskelet ve Temel"

Cohesion: 0.29
Nodes (7): 2026-07-13 · Faz 0 — Iskelet ve Temel, Bitti kriteri kontrolu (Faz 0), CLAUDE.md ile UYUSMAZLIK (§16.4 — bildiriliyor, onaysiz kural degistirilmedi), Kararlar, Sonraki adim, VARSAYIM (CLAUDE.md §7'ye eklenmesi onerilir), Yapilan

### Community 244 - "2026-07-14 · Faz 1 — Cekirdek MVP"

Cohesion: 0.29
Nodes (7): 2026-07-14 · Faz 1 — Cekirdek MVP, Bitti kriteri kontrolu (Faz 1), CLAUDE.md ile UYUSMAZLIK → **COZULDU (kullanici onayi, 14.07.2026)**, Kararlar, Sonraki adim, VARSAYIM (CLAUDE.md §7'ye eklenmesi onerilir), Yapilan

### Community 245 - "2026-07-15 · Faz 5 — Sertlestirme ve Yayin (§11, §13)"

Cohesion: 0.29
Nodes (7): 2026-07-15 · Faz 5 — Sertlestirme ve Yayin (§11, §13), Bitti kriteri kontrolu (Faz 5 — kod tarafi), Karar, Sema degisikligi, Sonraki adim, VARSAYIM:, Yapilan

### Community 246 - "2026-07-17 · Faz 5 — Yuk testi + ekstre sorgusu yeniden kuruldu (§6.4, §13 yuk hedefi)"

Cohesion: 0.33
Nodes (6): 2026-07-17 · Faz 5 — Yuk testi + ekstre sorgusu yeniden kuruldu (§6.4, §13 yuk hedefi), Karar, Sema degisikligi, Sonraki adim, VARSAYIM:, Yapilan

### Community 247 - "2026-07-17 · Faz 5 — Sentry ×3 kod tarafi (§11.8)"

Cohesion: 0.40
Nodes (5): 2026-07-17 · Faz 5 — Sentry ×3 kod tarafi (§11.8), Karar, Sonraki adim, VARSAYIM:, Yapilan

## Knowledge Gaps

- **812 isolated node(s):** `0. Kimlik ve Kapsam`, `1. Değişmez Kurallar (NON-NEGOTIABLE — 12 madde)`, `2. Teknoloji Yığını (tamamı ücretsiz; sürümler bilinen-iyi alt sınır, kurulumda en güncel kararlıyı kullan)`, `3. Depo Yapısı`, `4. Ortam ve Komutlar` (+807 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **103 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `StatementCard()` connect `dependencies` to `RepresentativesController`, `scripts`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `Env` connect `TxClient` to `TenantContext`, `ImportsRepository`, `pdf.service.ts`, `tsconfig.json`, `metro.config.js`, `AuthRepository`, `base.js`, `globalEnv`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `row()` connect `money.ts` to `TransactionsRepository`, `RepresentativesController`, `app.module.ts`, `compilerOptions`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `0. Kimlik ve Kapsam`, `1. Değişmez Kurallar (NON-NEGOTIABLE — 12 madde)`, `2. Teknoloji Yığını (tamamı ücretsiz; sürümler bilinen-iyi alt sınır, kurulumda en güncel kararlıyı kullan)` to the rest of the system?**
  _812 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `BuyersService` be split into smaller, more focused modules?**
  _Cohesion score 0.10795454545454546 - nodes in this community are weakly interconnected._
- **Should `ImportsRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.06810035842293907 - nodes in this community are weakly interconnected._
- **Should `pdf.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
