import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';

/** Rate limit NODE_ENV=test iken app.module'de skipIf ile kapatilir (§11.1 dev/prod'da acik). */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('v1');
  app.use(cookieParser());
  await app.init();
  return app;
}

/** Seed'lenmis kayitlarin id'lerini okumak icin ham istemci (tenant eklentisi YOK). */
export const rawPrisma = new PrismaClient();

export interface SeedIds {
  seller1Id: string;
  seller2Id: string;
  a1Id: string;
  a2Id: string;
  a3Id: string;
  b1Id: string;
}

export async function loadSeedIds(): Promise<SeedIds> {
  const [s1, s2] = await Promise.all([
    rawPrisma.seller.findUniqueOrThrow({ where: { slug: 'anadolu-gida' } }),
    rawPrisma.seller.findUniqueOrThrow({ where: { slug: 'ege-tekstil' } }),
  ]);
  const accounts = await rawPrisma.buyerAccount.findMany({ orderBy: { accountCode: 'asc' } });
  const find = (sellerId: string, code: string) => {
    const account = accounts.find((a) => a.sellerId === sellerId && a.accountCode === code);
    if (!account) throw new Error(`Seed carisi bulunamadi: ${code}`);
    return account.id;
  };

  return {
    seller1Id: s1.id,
    seller2Id: s2.id,
    a1Id: find(s1.id, '120.01.001'),
    a2Id: find(s1.id, '120.01.002'),
    a3Id: find(s1.id, '120.01.003'),
    b1Id: find(s2.id, 'CARI-001'),
  };
}

export const SEED_PASSWORD = 'CariNet2026!';

export const USERS = {
  seller1Admin: 'admin@anadolugida.com',
  seller1Staff: 'personel@anadolugida.com',
  seller2Admin: 'admin@egetekstil.com',
  buyer1: 'ahmet@bakkalim.com',
  buyerMulti: 'mehmet@zincirmarket.com',
} as const;

/** JWT govdesini cozer (imza dogrulamasi testin konusu degil). */
export function decodeJwt(token: string): Record<string, unknown> {
  const part = token.split('.')[1];
  if (!part) throw new Error('Bozuk JWT');
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
}
