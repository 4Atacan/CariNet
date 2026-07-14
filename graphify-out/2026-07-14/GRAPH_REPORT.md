# Graph Report - . (2026-07-13)

## Corpus Check

- cluster-only mode — file stats not available

## Summary

- 1007 nodes · 1420 edges · 93 communities (54 shown, 39 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.63)
- Token cost: 0 input · 0 output

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

## God Nodes (most connected - your core abstractions)

1. `AuthRepository` - 33 edges
2. `AuthController` - 24 edges
3. `AuthService` - 23 edges
4. `globalEnv` - 21 edges
5. `toDecimal()` - 19 edges
6. `compilerOptions` - 17 edges
7. `RequestUser` - 15 edges
8. `scripts` - 14 edges
9. `TokenService` - 13 edges
10. `Env` - 12 edges

## Surprising Connections (you probably didn't know these)

- `bootstrap()` --indirect_call--> `AppModule` [INFERRED]
  apps/api/src/main.ts → apps/api/src/app.module.ts
- `createTestApp()` --indirect_call--> `AppModule` [INFERRED]
  apps/api/test/setup/test-app.ts → apps/api/src/app.module.ts
- `LoginScreen()` --calls--> `useSession` [EXTRACTED]
  apps/mobile/app/giris.tsx → apps/mobile/src/store/session.ts
- `reset()` --references--> `@prisma/client` [EXTRACTED]
  apps/api/prisma/seed.ts → apps/api/package.json
- `main()` --calls--> `encryptSecret()` [EXTRACTED]
  apps/api/prisma/seed.ts → apps/api/src/common/crypto/encryption.ts

## Import Cycles

- None detected.

## Communities (93 total, 39 thin omitted)

### Community 0 - "money.ts"

Cohesion: 0.05
Nodes (59): CollectChannel, collectChannelSchema, DocumentType, documentTypeSchema, ImportRowStatus, importRowStatusSchema, ImportSourceType, importSourceTypeSchema (+51 more)

### Community 1 - "devDependencies"

Cohesion: 0.04
Nodes (45): devDependencies, @carinet/config, dotenv, dotenv-cli, eslint, @nestjs/cli, @nestjs/schematics, @nestjs/testing (+37 more)

### Community 2 - "dependencies"

Cohesion: 0.04
Nodes (44): dependencies, @carinet/shared, @hookform/resolvers, next, react, react-dom, react-hook-form, @tanstack/react-query (+36 more)

### Community 3 - "auth.controller.ts"

Cohesion: 0.16
Nodes (23): CurrentUser, NoTenant(), Public(), RefreshRoute(), RequestUser, AuthController, ApiOperation, ApiTags (+15 more)

### Community 4 - "globalEnv"

Cohesion: 0.05
Nodes (39): ^build, coverage/**, DATABASE_URL, .env, EXPO_PUBLIC_API_URL, JWT_ACCESS_SECRET, JWT_ACCESS_TTL, JWT_REFRESH_SECRET (+31 more)

### Community 5 - "dependencies"

Cohesion: 0.05
Nodes (37): dependencies, @babel/runtime, @carinet/shared, expo, expo-constants, expo-linking, expo-router, expo-secure-store (+29 more)

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

Cohesion: 0.14
Nodes (18): HomeScreen(), MeResponse, styles, plugins, LoginScreen(), styles, api(), ApiError (+10 more)

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

Cohesion: 0.08
Nodes (23): devDependencies, @carinet/config, eslint, @types/node, @types/react, typescript, @carinet/config, eslint (+15 more)

### Community 15 - "auth.ts"

Cohesion: 0.09
Nodes (23): userRoleSchema, AcceptInviteInput, acceptInviteSchema, AuthenticatedUser, AuthTokens, CreateInviteInput, createInviteSchema, emailSchema (+15 more)

### Community 16 - "scripts"

Cohesion: 0.10
Nodes (19): name, prisma, seed, private, scripts, build, db:deploy, db:generate (+11 more)

### Community 17 - "compilerOptions"

Cohesion: 0.10
Nodes (19): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module (+11 more)

### Community 18 - "buyers.service.ts"

Cohesion: 0.16
Nodes (7): Paginated, BuyersModule, Module, BuyersRepository, Injectable, BuyersService, Injectable

### Community 19 - "compilerOptions"

Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, declaration, declarationMap, incremental, jsx, lib, module (+9 more)

### Community 20 - "prisma.module.ts"

Cohesion: 0.18
Nodes (9): Inject, HealthController, ApiOperation, ApiTags, Controller, Get, Inject, PRISMA (+1 more)

### Community 21 - "AuthService"

Cohesion: 0.29
Nodes (3): AuthService, Injectable, ClientMeta

### Community 22 - "tsconfig.json"

Cohesion: 0.12
Nodes (16): compilerOptions, baseUrl, noUncheckedIndexedAccess, paths, strict, exclude, extends, include (+8 more)

### Community 23 - "expo"

Cohesion: 0.12
Nodes (15): package, typedRoutes, expo, android, experiments, ios, name, newArchEnabled (+7 more)

### Community 24 - "seed.ts"

Cohesion: 0.23
Nodes (12): @prisma/client, day(), main(), prisma, referenceCode(), reset(), decryptSecret(), encryptSecret() (+4 more)

### Community 25 - "app.module.ts"

Cohesion: 0.14
Nodes (7): JwtAuthGuard, Injectable, RolesGuard, Injectable, ResponseInterceptor, Injectable, validateEnv()

### Community 26 - "TokenService"

Cohesion: 0.21
Nodes (3): sha256(), TokenService, Injectable

### Community 27 - "tenant-context.ts"

Cohesion: 0.16
Nodes (8): TenantGuard, Injectable, TenantContextMiddleware, Injectable, EMPTY, storage, TenantContext, TenantStore

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

Cohesion: 0.31
Nodes (9): AppModule, Module, bootstrap(), createTestApp(), decodeJwt(), loadSeedIds(), rawPrisma, SeedIds (+1 more)

### Community 32 - "base.js"

Cohesion: 0.27
Nodes (4): base, nest, next, reactNative

### Community 33 - "BuyersController"

Cohesion: 0.24
Nodes (7): BuyersController, ApiOperation, ApiTags, Controller, Get, Param, Query

### Community 34 - "tenant-guard.extension.ts"

Cohesion: 0.29
Nodes (9): Args, CREATE_OPS, injectData(), injectWhere(), isPlainObject(), TENANT_MODELS, tenantForbidden(), tenantGuardExtension (+1 more)

### Community 35 - "MailService"

Cohesion: 0.28
Nodes (3): sha256(), MailService, Injectable

### Community 36 - "index.ts"

Cohesion: 0.50
Nodes (3): Roles(), RequestWithUser, ListBuyersQueryDto

### Community 37 - "exclude"

Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/_.spec.ts, ./tsconfig.json, \**/_.test.ts

### Community 38 - "nest-cli.json"

Cohesion: 0.29
Nodes (6): collection, compilerOptions, deleteOutDir, tsConfigPath, $schema, sourceRoot

### Community 39 - "dependencies"

Cohesion: 0.29
Nodes (7): dependencies, argon2, @nestjs/config, otplib, argon2, @nestjs/config, otplib

### Community 40 - "AllExceptionsFilter"

Cohesion: 0.38
Nodes (3): AllExceptionsFilter, HTTP_TO_CODE, Catch

### Community 41 - "PrismaModule"

Cohesion: 0.33
Nodes (4): PrismaModule, Inject, Module, Global

### Community 42 - "metro.config.js"

Cohesion: 0.40
Nodes (4): config, { getDefaultConfig }, path, workspaceRoot

### Community 43 - "post-commit"

Cohesion: 0.40
Nodes (4): GRAPHIFY_CHANGED, GRAPHIFY_REBUILD_LOG, post-commit script, PYTHONHASHSEED

### Community 44 - "post-checkout"

Cohesion: 0.50
Nodes (3): GRAPHIFY_REBUILD_LOG, post-checkout script, PYTHONHASHSEED

## Knowledge Gaps

- **403 isolated node(s):** `husky.sh script`, `$schema`, `collection`, `sourceRoot`, `deleteOutDir` (+398 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `scripts`, `seed.ts`, `@carinet/shared`, `cookie-parser`, `decimal.js`, `helmet`, `@nestjs/common`, `@nestjs/core`, `@nestjs/jwt`, `@nestjs/passport`, `nestjs-pino`, `@nestjs/platform-express`, `@nestjs/schedule`, `@nestjs/swagger`, `@nestjs/throttler`, `nestjs-zod`, `nodemailer`, `passport`, `passport-jwt`, `pino`, `pino-http`, `reflect-metadata`, `rxjs`, `zod`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `AuthRepository` connect `AuthRepository` to `MailService`, `auth.module.ts`, `prisma.module.ts`, `AuthService`, `TokenService`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `scripts`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `husky.sh script`, `$schema`, `collection` to the rest of the system?**
  _403 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `money.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0506558118498417 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
