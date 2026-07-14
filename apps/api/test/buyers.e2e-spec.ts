import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  SEED_PASSWORD,
  USERS,
  type SeedIds,
  createTestApp,
  loadSeedIds,
  rawPrisma,
} from './setup/test-app';

/** Faz 1 — cari CRUD + temsilci + limit + canli bakiye. Tenant matrisi dahil (kural #3). */
describe('Cari hesaplar (e2e)', () => {
  let app: INestApplication;
  let ids: SeedIds;
  const tokens: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const login = async (email: string): Promise<string> => {
    const res = await http().post('/v1/auth/login').send({ email, password: SEED_PASSWORD });
    return res.body.data.tokens.accessToken;
  };

  beforeAll(async () => {
    app = await createTestApp();
    ids = await loadSeedIds();
    tokens.s1Admin = await login(USERS.seller1Admin);
    tokens.s1Staff = await login(USERS.seller1Staff);
    tokens.s2Admin = await login(USERS.seller2Admin);
    tokens.buyer1 = await login(USERS.buyer1);
  });

  afterAll(async () => {
    // Seed kurgusu degismez kalmali (§4) — bu testin urettigi cariler temizlenir.
    // Hareketleri olmadigi icin hard delete guvenli; finansal kayda dokunulmuyor (kural #4).
    await rawPrisma.buyerAccount.deleteMany({ where: { accountCode: { startsWith: 'E2E' } } });
    await app.close();
    await rawPrisma.$disconnect();
  });

  describe('CRUD', () => {
    it('cari olusturur ve canli bakiye ile listeler', async () => {
      const created = await http()
        .post('/v1/buyers')
        .set(auth(tokens.s1Admin!))
        .send({ accountCode: 'E2E-001', title: 'E2E Test Cari A.S.', creditLimit: '50000.00' })
        .expect(201);

      expect(created.body.data.accountCode).toBe('E2E-001');
      expect(created.body.data.creditLimit).toBe('50000.00'); // MoneyString, number degil

      const list = await http().get('/v1/buyers?q=E2E-001').set(auth(tokens.s1Admin!)).expect(200);

      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].balance.balance).toBe('0.00'); // hareket yok → bakiye 0
    });

    it('ayni satici icinde ayni cari kodu iki kez kullanilamaz', async () => {
      const res = await http()
        .post('/v1/buyers')
        .set(auth(tokens.s1Admin!))
        .send({ accountCode: 'E2E-001', title: 'Kopya' })
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('cari kodu YALNIZ satici icinde benzersizdir — satici-2 ayni kodu kullanabilir', async () => {
      await http()
        .post('/v1/buyers')
        .set(auth(tokens.s2Admin!))
        .send({ accountCode: 'E2E-001', title: 'Satici-2 ayni kod' })
        .expect(201);
    });

    it('cari kodu degisince eski kod tarihceye yazilir (havale eslestirmesi icin)', async () => {
      const account = await rawPrisma.buyerAccount.findFirstOrThrow({
        where: { sellerId: ids.seller1Id, accountCode: 'E2E-001' },
      });

      await http()
        .patch(`/v1/buyers/${account.id}`)
        .set(auth(tokens.s1Admin!))
        .send({ accountCode: 'E2E-001-YENI' })
        .expect(200);

      const history = await http()
        .get(`/v1/buyers/${account.id}/code-history`)
        .set(auth(tokens.s1Admin!))
        .expect(200);

      expect(history.body.data[0].oldCode).toBe('E2E-001');
    });

    it('silme ucu YOKTUR — pasife alma vardir (kural #4)', async () => {
      const account = await rawPrisma.buyerAccount.findFirstOrThrow({
        where: { sellerId: ids.seller1Id, accountCode: 'E2E-001-YENI' },
      });

      await http().delete(`/v1/buyers/${account.id}`).set(auth(tokens.s1Admin!)).expect(404);

      const res = await http()
        .patch(`/v1/buyers/${account.id}/active`)
        .set(auth(tokens.s1Admin!))
        .send({ isActive: false })
        .expect(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('pasif cariye hareket girilemez', async () => {
      const account = await rawPrisma.buyerAccount.findFirstOrThrow({
        where: { sellerId: ids.seller1Id, accountCode: 'E2E-001-YENI' },
      });

      const res = await http()
        .post('/v1/transactions')
        .set(auth(tokens.s1Admin!))
        .send({
          buyerAccountId: account.id,
          type: 'DEBIT',
          documentType: 'OTHER',
          documentDate: '2026-07-01',
          amount: '100.00',
        })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('roller', () => {
    it('personel cari olusturabilir ama pasife ALAMAZ (yalniz admin)', async () => {
      await http()
        .post('/v1/buyers')
        .set(auth(tokens.s1Staff!))
        .send({ accountCode: 'E2E-STAFF', title: 'Personel carisi' })
        .expect(201);

      const account = await rawPrisma.buyerAccount.findFirstOrThrow({
        where: { sellerId: ids.seller1Id, accountCode: 'E2E-STAFF' },
      });

      const res = await http()
        .patch(`/v1/buyers/${account.id}/active`)
        .set(auth(tokens.s1Staff!))
        .send({ isActive: false })
        .expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('tenant izolasyonu (kural #3)', () => {
    it('satici-2 admini satici-1 carisini GUNCELLEYEMEZ', async () => {
      const res = await http()
        .patch(`/v1/buyers/${ids.a1Id}`)
        .set(auth(tokens.s2Admin!))
        .send({ title: 'Ele gecirildi' })
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');

      const untouched = await rawPrisma.buyerAccount.findUniqueOrThrow({ where: { id: ids.a1Id } });
      expect(untouched.title).not.toBe('Ele gecirildi');
    });

    it('satici-2 admini satici-1 carisini pasife ALAMAZ', async () => {
      await http()
        .patch(`/v1/buyers/${ids.a1Id}/active`)
        .set(auth(tokens.s2Admin!))
        .send({ isActive: false })
        .expect(404);

      const untouched = await rawPrisma.buyerAccount.findUniqueOrThrow({ where: { id: ids.a1Id } });
      expect(untouched.isActive).toBe(true);
    });

    it('alici baska carinin ekstresini goremez', async () => {
      const res = await http()
        .get(`/v1/buyers/${ids.a2Id}/statement`)
        .set(auth(tokens.buyer1!))
        .expect(403);
      expect(res.body.error.code).toBe('TENANT_FORBIDDEN');
    });
  });

  describe('mobil dashboard — GET /buyers/me', () => {
    it('alici kendi carisini, bakiyesini ve son 10 hareketini gorur', async () => {
      const res = await http().get('/v1/buyers/me').set(auth(tokens.buyer1!)).expect(200);

      expect(res.body.data.account.id).toBe(ids.a1Id);
      expect(res.body.data.recentTransactions.length).toBeLessThanOrEqual(10);
      expect(res.body.data.balance.balance).toMatch(/^-?\d+\.\d{2}$/); // MoneyString
    });

    it('satici tarafi /buyers/me ucunu kullanamaz', async () => {
      await http().get('/v1/buyers/me').set(auth(tokens.s1Admin!)).expect(403);
    });

    it('alici kendi ekstresini yuruyen bakiyeyle ceker (mobil sonsuz kaydirma)', async () => {
      const res = await http()
        .get('/v1/buyers/me/statement?limit=5')
        .set(auth(tokens.buyer1!))
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].runningBalance).toMatch(/^-?\d+\.\d{2}$/);
      expect(res.body.meta.total).toBeGreaterThan(5); // sayfalama meta'si dolu
    });
  });
});
