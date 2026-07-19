import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { loggerOptions } from './config/logger';
import { validateEnv } from './config/env';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { AuditModule } from './common/audit/audit.module';
import { StorageModule } from './common/storage/storage.module';
import { PrismaModule } from './prisma/prisma.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { AuthModule } from './modules/auth/auth.module';
import { BuyersModule } from './modules/buyers/buyers.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { ExchangeRatesModule } from './modules/exchange-rates/exchange-rates.module';
import { PlatformModule } from './modules/platform/platform.module';
import { ExportsModule } from './modules/exports/exports.module';
import { ImportsModule } from './modules/imports/imports.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProductsModule } from './modules/products/products.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RepresentativesModule } from './modules/representatives/representatives.module';
import { RequestsModule } from './modules/requests/requests.module';
import { SellersModule } from './modules/sellers/sellers.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: ['../../.env'] }),
    // §11.6 — pino + REDACTION (parola/token/IBAN/kart loglara sizmaz).
    LoggerModule.forRoot(loggerOptions()),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      // Testlerde rate limit kapali; kural olarak dev/prod'da HER ZAMAN acik (§11.1).
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    // Testte cron calismasin: intent suresi dolma isi e2e'yi zamanla yarisa sokmasin.
    ...(process.env.NODE_ENV === 'test' ? [] : [ScheduleModule.forRoot()]),
    PrismaModule,
    AuditModule,
    StorageModule,
    AuthModule,
    BuyersModule,
    RepresentativesModule,
    TransactionsModule,
    InvoicesModule,
    ImportsModule,
    ReportsModule,
    AddressesModule,
    NotificationsModule,
    CollectionsModule,
    SellersModule,
    ProductsModule,
    CampaignsModule,
    ExchangeRatesModule,
    RequestsModule,
    ExportsModule,
    PlatformModule,
  ],
  controllers: [HealthController],
  providers: [
    // Kural #7: her dis sinirda Zod (govde, query, param).
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Sira onemli: once rate limit, sonra kimlik, sonra rol, sonra tenant (§6.1).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('*path');
  }
}
