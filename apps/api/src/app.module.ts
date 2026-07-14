import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { validateEnv } from './config/env';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { AuditModule } from './common/audit/audit.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { BuyersModule } from './modules/buyers/buyers.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { RepresentativesModule } from './modules/representatives/representatives.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: ['../../.env'] }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      // Testlerde rate limit kapali; kural olarak dev/prod'da HER ZAMAN acik (§11.1).
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    BuyersModule,
    RepresentativesModule,
    TransactionsModule,
    InvoicesModule,
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
