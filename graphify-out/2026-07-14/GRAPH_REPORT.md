# Graph Report - . (2026-07-14)

## Corpus Check

- cluster-only mode — file stats not available

## Summary

- 2071 nodes · 3860 edges · 185 communities (97 shown, 88 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness

- Built from commit: `64789ba5`
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

- `groupByAccount()` --indirect_call--> `row()` [INFERRED]
  apps/api/src/modules/reports/reports.service.ts → packages/shared/src/collections.spec.ts
- `injectData()` --indirect_call--> `row()` [INFERRED]
  apps/api/src/prisma/tenant-guard.extension.ts → packages/shared/src/collections.spec.ts
- `buildWorkbook()` --indirect_call--> `row()` [INFERRED]
  apps/api/test/imports.e2e-spec.ts → packages/shared/src/collections.spec.ts
- `NewTransactionForm()` --indirect_call--> `DocumentType` [INFERRED]
  apps/panel/src/app/panel/hareketler/page.tsx → packages/shared/src/enums.ts
- `createTestApp()` --indirect_call--> `AppModule` [INFERRED]
  apps/api/test/setup/test-app.ts → apps/api/src/app.module.ts

## Import Cycles

- None detected.

## Communities (185 total, 88 thin omitted)

### Community 0 - "types.ts"

Cohesion: 0.07
Nodes (90): BankAccountsCard(), PosCard(), AddressesCard(), AgingCard(), BuyerDetailPage(), downloadStatementPdf(), BuyersPage(), NewBuyerForm() (+82 more)

### Community 1 - "BuyersService"

Cohesion: 0.05
Nodes (40): BuyersController, CreateBuyerDto, ListBuyersQueryDto, SELLER_SIDE, SetActiveDto, StatementQueryDto, ApiOperation, ApiTags (+32 more)

### Community 2 - "ImportsRepository"

Cohesion: 0.05
Nodes (32): ApiBody, BatchesQueryDto, CancelDto, CommitDto, filePipe, ImportsController, ReportQueryDto, RowsQueryDto (+24 more)

### Community 3 - "pdf.service.ts"

Cohesion: 0.05
Nodes (39): LedgerModule, Module, StatementLine, cell(), createPdfMake(), head(), PdfMake, PdfService (+31 more)

### Community 4 - "ana-sayfa.tsx"

Cohesion: 0.07
Nodes (41): Dashboard, HomeScreen(), MeResponse, RiskBucket(), RiskSummary, styles, fromDate(), RANGES (+33 more)

### Community 5 - ".log"

Cohesion: 0.08
Nodes (22): BankAccountDto, PosConfigDto, SellersController, TotpQueryDto, ApiOperation, ApiTags, Body, Controller (+14 more)

### Community 6 - "CollectionsController"

Cohesion: 0.09
Nodes (19): CollectionsController, ApiConsumes, ApiOperation, ApiTags, Body, Controller, CurrentUser, Get (+11 more)

### Community 7 - "compilerOptions"

Cohesion: 0.04
Nodes (44): compilerOptions, baseUrl, outDir, paths, rootDir, types, exclude, extends (+36 more)

### Community 8 - "money.ts"

Cohesion: 0.09
Nodes (43): TransactionType, add(), applyRate(), BalanceMovement, computeBalance(), computeRunningBalances(), currencyCodeSchema, div() (+35 more)

### Community 9 - "statement.service.ts"

Cohesion: 0.06
Nodes (29): StorageModule, Global, Module, StorageService, Injectable, BulkConfirmDto, CancelIntentDto, ConfirmIntentDto (+21 more)

### Community 10 - "RepresentativesController"

Cohesion: 0.08
Nodes (20): CreateRepresentativeDto, RepresentativesController, ApiOperation, ApiTags, Body, Controller, Delete, Get (+12 more)

### Community 11 - "PrismaService"

Cohesion: 0.10
Nodes (21): AuditEntry, AuditService, jsonReplacer(), toJson(), Inject, Injectable, Inject, REPRESENTATIVE_SELECT (+13 more)

### Community 12 - "index.ts"

Cohesion: 0.06
Nodes (19): CurrentUser, Public(), JwtAuthGuard, Injectable, RolesGuard, Injectable, TenantGuard, Injectable (+11 more)

### Community 13 - "sandbox-pos.adapter.ts"

Cohesion: 0.11
Nodes (17): CardPosProvider, readOrderId(), Injectable, HostedPaymentRequest, HostedPaymentStart, InstallmentOption, PosAdapter, PosCallbackResult (+9 more)

### Community 14 - "package.json"

Cohesion: 0.06
Nodes (34): default, dependencies, decimal.js, zod, devDependencies, @carinet/config, eslint, rimraf (+26 more)

### Community 15 - "AuthController"

Cohesion: 0.20
Nodes (16): AuthController, ApiOperation, ApiTags, Body, Controller, CurrentUser, Get, Post (+8 more)

### Community 16 - "CLAUDE.md — CariNet · B2B Cari Hesap Platformu (Ana Beyin)"

Cohesion: 0.06
Nodes (32): 0. Kimlik ve Kapsam, 10. API Sözleşmesi, 11. Güvenlik (8 katman — Faz 5'in release kapısı; "öneri" değil GEREKSİNİM), 12. Kodlama Standartları, 13. Geliştirme Fazları (sıralı; "bitti kriteri" sağlanmadan faz kapanmaz), 14. Yapılmayacaklar (açık yasaklar), 15. Definition of Done (her görev), 16. AI Çalışma Protokolü (Claude Code) (+24 more)

### Community 17 - "Env"

Cohesion: 0.10
Nodes (14): Env, envSchema, validateEnv(), AuthModule, Module, TWO_FA_ROLES, OPTIONS, PasswordService (+6 more)

### Community 18 - "AddressesService"

Cohesion: 0.10
Nodes (19): AddressesController, CreateAddressDto, ListQueryDto, ApiOperation, ApiTags, Body, Controller, CurrentUser (+11 more)

### Community 19 - "collections.module.ts"

Cohesion: 0.16
Nodes (15): IntentRow, CreatePendingIntent, IntentFactory, Injectable, BankTransferProvider, Injectable, CardPaymentStart, orderIdSchema (+7 more)

### Community 20 - "package.json"

Cohesion: 0.06
Nodes (31): husky, lint-staged, devDependencies, @carinet/config, husky, lint-staged, prettier, turbo (+23 more)

### Community 21 - "AuthRepository"

Cohesion: 0.10
Nodes (4): AuthRepository, Inject, Injectable, sha256()

### Community 22 - "TxClient"

Cohesion: 0.13
Nodes (6): CollectionsRepository, Inject, Injectable, randomSuffix(), describe(), TxClient

### Community 23 - "exports"

Cohesion: 0.07
Nodes (26): eslint-config-prettier, @eslint/js, globals, dependencies, eslint-config-prettier, @eslint/js, globals, typescript-eslint (+18 more)

### Community 24 - "InvoicesRepository"

Cohesion: 0.11
Nodes (12): CancelInvoiceDto, CreateInvoiceDto, ListInvoicesQueryDto, InvoicesRepository, Inject, Injectable, InvoicesService, toInvoiceDto() (+4 more)

### Community 25 - "TransactionsRepository"

Cohesion: 0.12
Nodes (12): CancelTransactionDto, CreateTransactionDto, ListTransactionsQueryDto, TransactionsRepository, Inject, Injectable, toIsoDate(), toTransactionDto() (+4 more)

### Community 26 - "auth.ts"

Cohesion: 0.09
Nodes (23): userRoleSchema, AcceptInviteInput, acceptInviteSchema, AuthenticatedUser, AuthTokens, CreateInviteInput, createInviteSchema, emailSchema (+15 more)

### Community 27 - "app.module.ts"

Cohesion: 0.14
Nodes (15): AuditModule, Global, Module, BuyersModule, Module, CollectionsModule, Module, InvoicesModule (+7 more)

### Community 28 - "collections.ts"

Cohesion: 0.09
Nodes (22): intentStatusSchema, BankAccountInput, bankAccountSchema, BankStatementRowInput, bankStatementRowSchema, BulkConfirmInput, bulkConfirmSchema, CancelIntentInput (+14 more)

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
Nodes (11): TenantContextMiddleware, Injectable, EMPTY, storage, TenantContext, TenantStore, IntentExpiryTask, Injectable (+3 more)

### Community 34 - "compilerOptions"

Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, declaration, declarationMap, incremental, jsx, lib, module (+9 more)

### Community 35 - "test-app.ts"

Cohesion: 0.18
Nodes (11): AppModule, Module, loadSchemaObjectFactory(), SchemaObjectFactoryClass, setupSwagger(), bootstrap(), createTestApp(), decodeJwt() (+3 more)

### Community 36 - "AuthService"

Cohesion: 0.29
Nodes (3): AuthService, Injectable, ClientMeta

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

Cohesion: 0.12
Nodes (16): CollectChannel, collectChannelSchema, DocumentType, ImportRowStatus, importRowStatusSchema, ImportSourceType, importSourceTypeSchema, ImportStatus (+8 more)

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

### Community 48 - "TokenService"

Cohesion: 0.23
Nodes (3): sha256(), TokenService, Injectable

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

Cohesion: 0.33
Nodes (10): asArray(), attr(), isNode(), Node, partyIdentifier(), pick(), sumStrings(), text() (+2 more)

### Community 53 - "scripts"

Cohesion: 0.15
Nodes (12): main, name, private, scripts, android, build, dev, ios (+4 more)

### Community 54 - "import.spec.ts"

Cohesion: 0.21
Nodes (10): ImportTarget, autoMap(), ColumnMapping, IMPORT_FIELDS, ImportField, normalizeHeader(), REQUIRED_FIELDS, TARGET_FIELDS (+2 more)

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

Cohesion: 0.31
Nodes (10): atUtcMidnight(), cellToDate(), cellToMoney(), cellToRate(), cellToText(), CellValue, EXCEL_EPOCH_UTC, neutralizeFormula() (+2 more)

### Community 63 - "common.ts"

Cohesion: 0.18
Nodes (9): ApiFailure, ApiResponse, ApiSuccess, cuidSchema, DateRangeQuery, dateRangeQuerySchema, PaginationMeta, PaginationQuery (+1 more)

### Community 64 - "tenant-guard.extension.ts"

Cohesion: 0.29
Nodes (9): Args, CREATE_OPS, injectData(), injectWhere(), isPlainObject(), TENANT_MODELS, tenantForbidden(), tenantGuardExtension (+1 more)

### Community 65 - "transactions.ts"

Cohesion: 0.20
Nodes (9): documentTypeSchema, transactionTypeSchema, CancelTransactionInput, cancelTransactionSchema, CreateTransactionInput, createTransactionSchema, isoDateSchema, TransactionListQuery (+1 more)

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

Cohesion: 0.33
Nodes (4): Inject, NotificationsService, Inject, Injectable

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

### Community 81 - "post-checkout"

Cohesion: 0.50
Nodes (3): GRAPHIFY_REBUILD_LOG, post-checkout script, PYTHONHASHSEED

### Community 82 - "turbo.json"

Cohesion: 0.50
Nodes (3): .env, globalDependencies, $schema

### Community 83 - "dev"

Cohesion: 0.67
Nodes (3): cache, persistent, dev

## Knowledge Gaps

- **648 isolated node(s):** `0. Kimlik ve Kapsam`, `1. Değişmez Kurallar (NON-NEGOTIABLE — 12 madde)`, `2. Teknoloji Yığını (tamamı ücretsiz; sürümler bilinen-iyi alt sınır, kurulumda en güncel kararlıyı kullan)`, `3. Depo Yapısı`, `4. Ortam ve Komutlar` (+643 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **88 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `StatementCard()` connect `types.ts` to `TxClient`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `row()` connect `row` to `tenant-guard.extension.ts`, `BuyersService`, `pdf.service.ts`, `collections.ts`, `TxClient`, `InvoicesRepository`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `PrismaService` connect `PrismaService` to `BuyersService`, `ImportsRepository`, `TenantContext`, `pdf.service.ts`, `.log`, `.constructor`, `RepresentativesController`, `index.ts`, `PrismaModule`, `collections.module.ts`, `AuthRepository`, `TxClient`, `InvoicesRepository`, `TransactionsRepository`, `app.module.ts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `0. Kimlik ve Kapsam`, `1. Değişmez Kurallar (NON-NEGOTIABLE — 12 madde)`, `2. Teknoloji Yığını (tamamı ücretsiz; sürümler bilinen-iyi alt sınır, kurulumda en güncel kararlıyı kullan)` to the rest of the system?**
  _648 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07185354691075514 - nodes in this community are weakly interconnected._
- **Should `BuyersService` be split into smaller, more focused modules?**
  _Cohesion score 0.05209274314965372 - nodes in this community are weakly interconnected._
- **Should `ImportsRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.050721954831543875 - nodes in this community are weakly interconnected._
