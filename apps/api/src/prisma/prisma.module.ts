import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantGuardExtension } from './tenant-guard.extension';

/**
 * Tenant korumali Prisma istemcisi (kural #3).
 * Repository'ler bu istemciyi enjekte eder; ham `PrismaClient` uygulama kodunda KULLANILMAZ.
 */
export const PRISMA = Symbol('PRISMA');

export const createPrismaClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  }).$extends(tenantGuardExtension);

export type PrismaService = ReturnType<typeof createPrismaClient>;

@Global()
@Module({
  providers: [{ provide: PRISMA, useFactory: createPrismaClient }],
  exports: [PRISMA],
})
export class PrismaModule implements OnModuleDestroy {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
