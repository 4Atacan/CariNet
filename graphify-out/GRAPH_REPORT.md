# Graph Report - CariNet (2026-07-14)

## Corpus Check

- 156 files · ~42,086 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 1439 nodes · 2220 edges · 152 communities (82 shown, 70 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness

- Built from commit: `c4831d8d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)

- money.ts
- devDependencies
- dependencies
- auth.controller.ts
- globalEnv
- dependencies
- package.json
- compilerOptions
- package.json
- ana-sayfa.tsx
- auth.module.ts
- AuthRepository
- page.tsx
- exports
- scripts
- auth.ts
- scripts
- compilerOptions
- buyers.service.ts
- compilerOptions
- prisma.module.ts
- AuthService
- tsconfig.json
- expo
- seed.ts
- app.module.ts
- TokenService
- tenant-context.ts
- exclude
- compilerOptions
- tsconfig.json
- test-app.ts
- base.js
- BuyersController
- tenant-guard.extension.ts
- MailService
- index.ts
- exclude
- nest-cli.json
- dependencies
- AllExceptionsFilter
- PrismaModule
- metro.config.js
- post-commit
- post-checkout
- h
- @carinet/shared
- cookie-parser
- decimal.js
- helmet
- @nestjs/common
- @nestjs/core
- @nestjs/jwt
- @nestjs/passport
- nestjs-pino
- @nestjs/platform-express
- @nestjs/schedule
- @nestjs/swagger
- @nestjs/throttler
- nestjs-zod
- nodemailer
- passport
- passport-jwt
- pino
- pino-http
- reflect-metadata
- rxjs
- zod
- next-env.d.ts
- applypatch-msg
- commit-msg
- husky.sh
- post-applypatch
- post-checkout
- post-commit
- post-merge
- post-rewrite
- pre-applypatch
- pre-auto-gc
- pre-commit
- pre-merge-commit
- pre-push
- pre-rebase
- prepare-commit-msg
- TransactionsRepository
- TransactionsController
- InvoicesController
- app.module.ts
- buyers.service.ts
- devDependencies
- common.ts
- Paginated
- errors.ts
- package.json
- @nestjs/config
- dotenv
- dotenv-cli
- eslint
- @nestjs/cli
- @nestjs/schematics
- @nestjs/testing
- pino-pretty
- prisma
- supertest
- @types/cookie-parser
- @types/express
- @types/node
- @types/nodemailer
- @types/passport-jwt
- vitest
- @babel/runtime
- expo
- expo-linking
- expo-router
- expo-status-bar
- @hookform/resolvers
- react-hook-form
- react-native-safe-area-context
- react-native-screens
- zod
- zustand
- Global
- Param
- Query
- buyers.ts
- import-mapping.ts
- imports.controller.ts
- .constructor
- HealthController
- transactions.ts
- exceljs
- fast-xml-parser
- @nestjs/common
- otplib
- @swc/core
- @types/multer
- typescript
- unplugin-swc
- vite-tsconfig-paths

## God Nodes (most connected - your core abstractions)

1. `AuthRepository` - 33 edges
2. `PrismaService` - 26 edges
3. `ImportsRepository` - 25 edges
4. `AuthController` - 24 edges
5. `AuthService` - 23 edges
6. `globalEnv` - 21 edges
7. `BuyersService` - 20 edges
8. `toDecimal()` - 19 edges
9. `ImportsService` - 18 edges
10. `compilerOptions` - 17 edges

## Surprising Connections (you probably didn't know these)

- `bootstrap()` --indirect_call--> `AppModule` [INFERRED]
  apps/api/src/main.ts → apps/api/src/app.module.ts
- `createTestApp()` --indirect_call--> `AppModule` [INFERRED]
  apps/api/test/setup/test-app.ts → apps/api/src/app.module.ts
- `BalanceMovement` --references--> `TransactionType` [EXTRACTED]
  packages/shared/src/money.ts → packages/shared/src/enums.ts
- `LoginScreen()` --calls--> `useSession` [EXTRACTED]
  apps/mobile/app/giris.tsx → apps/mobile/src/store/session.ts
- `reset()` --references--> `@prisma/client` [EXTRACTED]
  apps/api/prisma/seed.ts → apps/api/package.json

## Import Cycles

- None detected.

## Communities (152 total, 70 thin omitted)

### Community 0 - "money.ts"

Cohesion: 0.17
Nodes (27): TransactionType, add(), applyRate(), BalanceMovement, computeBalance(), computeRunningBalances(), currencyCodeSchema, div() (+19 more)

### Community 1 - "devDependencies"

Cohesion: 0.13
Nodes (15): devDependencies, @carinet/config, @nestjs/cli, tsx, @types/adm-zip, @types/cookie-parser, @types/passport-jwt, @types/supertest (+7 more)

### Community 2 - "dependencies"

Cohesion: 0.04
Nodes (44): dependencies, @carinet/shared, @hookform/resolvers, next, react, react-dom, react-hook-form, @tanstack/react-query (+36 more)

### Community 3 - "auth.controller.ts"

Cohesion: 0.07
Nodes (37): CurrentUser, NoTenant(), Public(), RefreshRoute(), Roles(), JwtAuthGuard, Injectable, RolesGuard (+29 more)

### Community 4 - "globalEnv"

Cohesion: 0.05
Nodes (39): ^build, coverage/**, DATABASE_URL, .env, EXPO_PUBLIC_API_URL, JWT_ACCESS_SECRET, JWT_ACCESS_TTL, JWT_REFRESH_SECRET (+31 more)

### Community 5 - "dependencies"

Cohesion: 0.13
Nodes (15): dependencies, @carinet/shared, expo-constants, expo-secure-store, react, react-dom, react-native, @tanstack/react-query (+7 more)

### Community 6 - "package.json"

Cohesion: 0.06
Nodes (34): default, dependencies, decimal.js, zod, devDependencies, @carinet/config, eslint, rimraf (+26 more)

### Community 7 - "compilerOptions"

Cohesion: 0.06
Nodes (32): compilerOptions, baseUrl, outDir, paths, rootDir, types, exclude, extends (+24 more)

### Community 8 - "package.json"

Cohesion: 0.06
Nodes (31): husky, lint-staged, devDependencies, @carinet/config, husky, lint-staged, prettier, turbo (+23 more)

### Community 9 - "ana-sayfa.tsx"

Cohesion: 0.07
Nodes (33): HomeScreen(), MeResponse, styles, package, typedRoutes, expo, android, experiments (+25 more)

### Community 10 - "auth.module.ts"

Cohesion: 0.12
Nodes (14): Env, envSchema, AuthModule, Module, TWO_FA_ROLES, OPTIONS, PasswordService, Injectable (+6 more)

### Community 11 - "AuthRepository"

Cohesion: 0.11
Nodes (3): AuthRepository, Inject, Injectable

### Community 12 - "page.tsx"

Cohesion: 0.11
Nodes (15): config, metadata, BuyerAccountRow, MeResponse, PanelPage(), QueryProvider(), api(), ApiError (+7 more)

### Community 13 - "exports"

Cohesion: 0.07
Nodes (26): eslint-config-prettier, @eslint/js, globals, dependencies, eslint-config-prettier, @eslint/js, globals, typescript-eslint (+18 more)

### Community 14 - "scripts"

Cohesion: 0.15
Nodes (12): main, name, private, scripts, android, build, dev, ios (+4 more)

### Community 15 - "auth.ts"

Cohesion: 0.09
Nodes (23): userRoleSchema, AcceptInviteInput, acceptInviteSchema, AuthenticatedUser, AuthTokens, CreateInviteInput, createInviteSchema, emailSchema (+15 more)

### Community 16 - "scripts"

Cohesion: 0.14
Nodes (14): scripts, build, db:deploy, db:generate, db:migrate, db:reset, db:seed, db:studio (+6 more)

### Community 17 - "compilerOptions"

Cohesion: 0.10
Nodes (19): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module (+11 more)

### Community 18 - "buyers.service.ts"

Cohesion: 0.15
Nodes (6): BuyersRepository, Inject, Injectable, BuyersService, toBuyerDto(), Injectable

### Community 19 - "compilerOptions"

Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, declaration, declarationMap, incremental, jsx, lib, module (+9 more)

### Community 20 - "prisma.module.ts"

Cohesion: 0.23
Nodes (10): AuditEntry, REPRESENTATIVE_SELECT, BUYER_SELECT, BuyerRef, InvoiceSummaryDto, InvoiceWithItems, BUYER_SELECT, PRISMA (+2 more)

### Community 21 - "AuthService"

Cohesion: 0.29
Nodes (3): AuthService, Injectable, ClientMeta

### Community 22 - "tsconfig.json"

Cohesion: 0.12
Nodes (16): compilerOptions, baseUrl, noUncheckedIndexedAccess, paths, strict, exclude, extends, include (+8 more)

### Community 23 - "expo"

Cohesion: 0.08
Nodes (20): CreateRepresentativeDto, RepresentativesController, ApiOperation, ApiTags, Body, Controller, Get, Param (+12 more)

### Community 24 - "seed.ts"

Cohesion: 0.23
Nodes (12): @prisma/client, day(), main(), prisma, referenceCode(), reset(), decryptSecret(), encryptSecret() (+4 more)

### Community 25 - "app.module.ts"

Cohesion: 0.13
Nodes (5): ImportsRepository, Inject, Injectable, ImportsService, Injectable

### Community 26 - "TokenService"

Cohesion: 0.21
Nodes (3): sha256(), TokenService, Injectable

### Community 27 - "tenant-context.ts"

Cohesion: 0.29
Nodes (9): Args, CREATE_OPS, injectData(), injectWhere(), isPlainObject(), TENANT_MODELS, tenantForbidden(), tenantGuardExtension (+1 more)

### Community 28 - "exclude"

Cohesion: 0.14
Nodes (13): compilerOptions, outDir, rootDir, exclude, extends, include, dist, node_modules (+5 more)

### Community 29 - "compilerOptions"

Cohesion: 0.14
Nodes (13): compilerOptions, emitDecoratorMetadata, experimentalDecorators, isolatedModules, lib, module, moduleResolution, strictPropertyInitialization (+5 more)

### Community 30 - "tsconfig.json"

Cohesion: 0.14
Nodes (13): compilerOptions, outDir, rootDir, types, exclude, extends, include, @carinet/config/typescript/nest (+5 more)

### Community 31 - "test-app.ts"

Cohesion: 0.27
Nodes (9): AppModule, Module, bootstrap(), createTestApp(), decodeJwt(), loadSeedIds(), rawPrisma, SeedIds (+1 more)

### Community 32 - "base.js"

Cohesion: 0.27
Nodes (4): base, nest, next, reactNative

### Community 33 - "BuyersController"

Cohesion: 0.14
Nodes (18): BuyersController, CreateBuyerDto, ListBuyersQueryDto, SELLER_SIDE, SetActiveDto, StatementQueryDto, ApiOperation, ApiTags (+10 more)

### Community 34 - "tenant-guard.extension.ts"

Cohesion: 0.15
Nodes (16): computeInvoiceTotals(), computeLineTotals(), InvoiceLineInput, InvoiceLineTotals, InvoiceTotals, quantitySchema, taxRateSchema, CancelInvoiceInput (+8 more)

### Community 35 - "MailService"

Cohesion: 0.28
Nodes (3): sha256(), MailService, Injectable

### Community 36 - "index.ts"

Cohesion: 0.13
Nodes (9): InvoicesRepository, Inject, Injectable, InvoicesService, toInvoiceDto(), toInvoiceSummary(), toIsoDate(), Inject (+1 more)

### Community 37 - "exclude"

Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/_.spec.ts, ./tsconfig.json, \**/_.test.ts

### Community 38 - "nest-cli.json"

Cohesion: 0.29
Nodes (6): collection, compilerOptions, deleteOutDir, tsConfigPath, $schema, sourceRoot

### Community 40 - "AllExceptionsFilter"

Cohesion: 0.38
Nodes (3): AllExceptionsFilter, HTTP_TO_CODE, Catch

### Community 41 - "PrismaModule"

Cohesion: 0.33
Nodes (4): PrismaModule, Global, Inject, Module

### Community 42 - "metro.config.js"

Cohesion: 0.40
Nodes (4): config, { getDefaultConfig }, path, workspaceRoot

### Community 43 - "post-commit"

Cohesion: 0.40
Nodes (4): GRAPHIFY_CHANGED, GRAPHIFY_REBUILD_LOG, post-commit script, PYTHONHASHSEED

### Community 44 - "post-checkout"

Cohesion: 0.50
Nodes (3): GRAPHIFY_REBUILD_LOG, post-checkout script, PYTHONHASHSEED

### Community 50 - "@nestjs/common"

Cohesion: 0.11
Nodes (19): BuyerDto, BuyerWithBalance, BuyerWithRepresentative, toIsoDate(), BalanceRawRow, LedgerRepository, SIGNED_TRY, StatementFilter (+11 more)

### Community 63 - "pino"

Cohesion: 0.22
Nodes (9): adm-zip, dependencies, adm-zip, @aws-sdk/client-s3, pino, rxjs, @aws-sdk/client-s3, pino (+1 more)

### Community 66 - "rxjs"

Cohesion: 0.10
Nodes (20): BuyerAccountRow, buyerAccountRowSchema, CancelImportInput, cancelImportSchema, columnMappingSchema, CommitImportInput, commitImportSchema, ImportRowsQuery (+12 more)

### Community 93 - "TransactionsRepository"

Cohesion: 0.12
Nodes (12): CancelTransactionDto, CreateTransactionDto, ListTransactionsQueryDto, TransactionsRepository, Inject, Injectable, toIsoDate(), toTransactionDto() (+4 more)

### Community 94 - "TransactionsController"

Cohesion: 0.22
Nodes (11): TransactionsController, ApiOperation, ApiTags, Body, Controller, CurrentUser, Get, Param (+3 more)

### Community 95 - "InvoicesController"

Cohesion: 0.22
Nodes (11): InvoicesController, ApiOperation, ApiTags, Body, Controller, CurrentUser, Get, Param (+3 more)

### Community 96 - "app.module.ts"

Cohesion: 0.17
Nodes (11): BuyersModule, Module, CancelInvoiceDto, CreateInvoiceDto, ListInvoicesQueryDto, InvoicesModule, Module, LedgerModule (+3 more)

### Community 97 - "buyers.service.ts"

Cohesion: 0.18
Nodes (8): AuditModule, Global, Module, AuditService, jsonReplacer(), toJson(), Inject, Injectable

### Community 98 - "devDependencies"

Cohesion: 0.18
Nodes (11): devDependencies, @carinet/config, eslint, @types/node, @types/react, typescript, @carinet/config, eslint (+3 more)

### Community 99 - "common.ts"

Cohesion: 0.18
Nodes (9): ApiFailure, ApiResponse, ApiSuccess, cuidSchema, DateRangeQuery, dateRangeQuerySchema, PaginationMeta, PaginationQuery (+1 more)

### Community 100 - "Paginated"

Cohesion: 0.29
Nodes (3): Paginated, ResponseInterceptor, Injectable

### Community 101 - "errors.ts"

Cohesion: 0.29
Nodes (5): AppError, AppErrorDetails, ERROR_MESSAGES, ErrorCode, HTTP_STATUS_BY_ERROR_CODE

### Community 102 - "package.json"

Cohesion: 0.33
Nodes (5): name, prisma, seed, private, version

### Community 107 - "@nestjs/cli"

Cohesion: 0.10
Nodes (19): CollectChannel, collectChannelSchema, DocumentType, documentTypeSchema, ImportRowStatus, importRowStatusSchema, ImportSourceType, importSourceTypeSchema (+11 more)

### Community 113 - "@types/cookie-parser"

Cohesion: 0.17
Nodes (7): assertFile(), formatIssues(), readCutoff(), ROW_SCHEMA, StagedRow, summarize(), toJson()

### Community 117 - "@types/passport-jwt"

Cohesion: 0.26
Nodes (12): atUtcMidnight(), cellToDate(), cellToMoney(), cellToRate(), cellToText(), CellValue, EXCEL_EPOCH_UTC, neutralizeFormula() (+4 more)

### Community 133 - "Global"

Cohesion: 0.20
Nodes (7): StorageModule, Module, StorageService, Injectable, ImportsModule, Module, Global

### Community 134 - "Param"

Cohesion: 0.15
Nodes (13): ApiBody, ApiConsumes, ApiOperation, ApiTags, ImportsController, UploadedFile, Controller, CurrentUser (+5 more)

### Community 135 - "Query"

Cohesion: 0.33
Nodes (10): asArray(), attr(), isNode(), Node, partyIdentifier(), pick(), sumStrings(), text() (+2 more)

### Community 136 - "buyers.ts"

Cohesion: 0.15
Nodes (12): accountCodeSchema, BuyerListQuery, buyerListQuerySchema, CreateBuyerAccountInput, createBuyerAccountSchema, CreateRepresentativeInput, createRepresentativeSchema, UpdateBuyerAccountInput (+4 more)

### Community 137 - "import-mapping.ts"

Cohesion: 0.20
Nodes (8): ImportTarget, autoMap(), ColumnMapping, IMPORT_FIELDS, ImportField, normalizeHeader(), REQUIRED_FIELDS, TARGET_FIELDS

### Community 138 - "imports.controller.ts"

Cohesion: 0.22
Nodes (8): BatchesQueryDto, CancelDto, CommitDto, filePipe, ReportQueryDto, RowsQueryDto, SaveTemplateDto, UploadDto

### Community 139 - ".constructor"

Cohesion: 0.25
Nodes (6): Inject, CELL_READERS, ExcelParser, ParsedSheet, toCellValue(), Injectable

### Community 140 - "HealthController"

Cohesion: 0.25
Nodes (6): HealthController, ApiOperation, ApiTags, Controller, Get, Inject

### Community 141 - "transactions.ts"

Cohesion: 0.25
Nodes (7): CancelTransactionInput, cancelTransactionSchema, CreateTransactionInput, createTransactionSchema, isoDateSchema, TransactionListQuery, transactionListQuerySchema

## Knowledge Gaps

- **501 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+496 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **70 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `prisma.module.ts` to `buyers.service.ts`, `index.ts`, `PrismaModule`, `AuthRepository`, `HealthController`, `buyers.service.ts`, `@nestjs/common`, `expo`, `TransactionsRepository`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `Public()` connect `auth.controller.ts` to `HealthController`, `prisma.module.ts`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `PRISMA` connect `prisma.module.ts` to `@nestjs/common`, `expo`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _501 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `auth.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07472613458528951 - nodes in this community are weakly interconnected._
