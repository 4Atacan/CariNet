import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeBalance, sub, toMoney } from '@carinet/shared';
import {
  SEED_PASSWORD,
  USERS,
  type SeedIds,
  createTestApp,
  loadSeedIds,
  rawPrisma,
} from './setup/test-app';

/** Faz 1 — hareket girisi/iptali + bakiye turetimi (kural #2, #4). */
describe('Hareketler (e2e)', () => {
  let app: INestApplication;
  let ids: SeedIds;
  const tokens: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const login = async (email: string): Promise<string> => {
    const res = await http().post('/v1/auth/login').send({ email, password: SEED_PASSWORD });
    return res.body.data.tokens.accessToken;
  };

  const balanceOf = async (accountId: string, token: string): Promise<string> => {
    const res = await http().get(`/v1/buyers/${accountId}`).set(auth(token)).expect(200);
    return res.body.data.balance.balance as string;
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
    await app.close();
    await rawPrisma.$disconnect();
  });

  describe('bakiye = Σ hareket (kural #2)', () => {
    it('API bakiyesi, ham hareketlerden elle hesaplanana esittir', async () => {
      const rows = await rawPrisma.transaction.findMany({
        where: { buyerAccountId: ids.a2Id, isCancelled: false },
      });
      // §6.4: bakiye TRY'dir → her satir KENDI kuruyla TRY'ye cevrilir (yuvarlama satir bazinda).
      // Ham tutar toplami varsayimi yapilmaz: bu cariye baska bir test dovizli satir birakabilir.
      const expected = computeBalance(
        rows.map((r) => ({
          type: r.type,
          amount: toMoney(r.amount.mul(r.exchangeRate).toString()),
        })),
      );

      expect(await balanceOf(ids.a2Id, tokens.s1Admin!)).toBe(expected);
    });

    it('DEBIT bakiyeyi artirir, CREDIT dusurur; iptal geri alir', async () => {
      const before = await balanceOf(ids.a2Id, tokens.s1Admin!);

      const debit = await http()
        .post('/v1/transactions')
        .set(auth(tokens.s1Staff!))
        .send({
          buyerAccountId: ids.a2Id,
          type: 'DEBIT',
          documentType: 'OTHER',
          documentNo: 'E2E-BORC-1',
          documentDate: '2026-07-10',
          amount: '1500.50',
          description: 'E2E borc',
        })
        .expect(201);

      const afterDebit = await balanceOf(ids.a2Id, tokens.s1Admin!);
      expect(sub(afterDebit, before)).toBe('1500.50'); // kural #1: karsilastirma da decimal.js ile

      await http()
        .post('/v1/transactions')
        .set(auth(tokens.s1Staff!))
        .send({
          buyerAccountId: ids.a2Id,
          type: 'CREDIT',
          documentType: 'PAYMENT',
          documentDate: '2026-07-11',
          amount: '500.50',
        })
        .expect(201);

      const afterCredit = await balanceOf(ids.a2Id, tokens.s1Admin!);
      expect(sub(afterCredit, afterDebit)).toBe('-500.50');

      // Iptal: kayit SILINMEZ, bakiyeden duser (kural #4).
      await http()
        .post(`/v1/transactions/${debit.body.data.id}/cancel`)
        .set(auth(tokens.s1Admin!))
        .send({ reason: 'E2E iptal testi' })
        .expect(201);

      const afterCancel = await balanceOf(ids.a2Id, tokens.s1Admin!);
      expect(sub(afterCancel, afterCredit)).toBe('-1500.50');

      const stillThere = await rawPrisma.transaction.findUniqueOrThrow({
        where: { id: debit.body.data.id },
      });
      expect(stillThere.isCancelled).toBe(true); // kayit duruyor
    });

    it('ayni hareket iki kez iptal edilemez', async () => {
      const tx = await rawPrisma.transaction.findFirstOrThrow({
        where: { buyerAccountId: ids.a2Id, isCancelled: true, invoiceId: null },
      });
      const res = await http()
        .post(`/v1/transactions/${tx.id}/cancel`)
        .set(auth(tokens.s1Admin!))
        .send({ reason: 'tekrar' })
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('faturaya bagli hareket tek basina iptal EDILEMEZ', async () => {
      const tx = await rawPrisma.transaction.findFirstOrThrow({
        where: { sellerId: ids.seller1Id, invoiceId: { not: null }, isCancelled: false },
      });
      const res = await http()
        .post(`/v1/transactions/${tx.id}/cancel`)
        .set(auth(tokens.s1Admin!))
        .send({ reason: 'olmaz' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('ekstre — yuruyen bakiye (§6.4)', () => {
    it('en yeni satirin yuruyen bakiyesi guncel bakiyeye esittir', async () => {
      const statement = await http()
        .get(`/v1/buyers/${ids.a3Id}/statement?limit=5`)
        .set(auth(tokens.s1Admin!))
        .expect(200);

      expect(statement.body.data.length).toBeGreaterThan(0);
      expect(statement.body.data[0].runningBalance).toBe(
        await balanceOf(ids.a3Id, tokens.s1Admin!),
      );
    });

    it('tarih filtresi yuruyen bakiyeyi BOZMAZ (devir dahil hesaplanir)', async () => {
      const all = await http()
        .get(`/v1/buyers/${ids.a3Id}/statement?limit=100`)
        .set(auth(tokens.s1Admin!))
        .expect(200);

      const newest = all.body.data[0];
      const filtered = await http()
        .get(`/v1/buyers/${ids.a3Id}/statement?from=${newest.documentDate}&limit=100`)
        .set(auth(tokens.s1Admin!))
        .expect(200);

      const same = filtered.body.data.find((r: { id: string }) => r.id === newest.id);
      expect(same.runningBalance).toBe(newest.runningBalance);
    });
  });

  describe('dogrulama (Zod — kural #7)', () => {
    it('negatif tutar reddedilir (yon `type` ile belirlenir)', async () => {
      await http()
        .post('/v1/transactions')
        .set(auth(tokens.s1Admin!))
        .send({
          buyerAccountId: ids.a2Id,
          type: 'DEBIT',
          documentType: 'OTHER',
          documentDate: '2026-07-10',
          amount: '-100.00',
        })
        .expect(400);
    });

    it('vade belge tarihinden once olamaz', async () => {
      await http()
        .post('/v1/transactions')
        .set(auth(tokens.s1Admin!))
        .send({
          buyerAccountId: ids.a2Id,
          type: 'DEBIT',
          documentType: 'OTHER',
          documentDate: '2026-07-10',
          dueDate: '2026-07-01',
          amount: '100.00',
        })
        .expect(400);
    });

    it('dovizli harekette kur zorunlu', async () => {
      await http()
        .post('/v1/transactions')
        .set(auth(tokens.s1Admin!))
        .send({
          buyerAccountId: ids.a2Id,
          type: 'DEBIT',
          documentType: 'OTHER',
          documentDate: '2026-07-10',
          amount: '100.00',
          currencyCode: 'USD',
        })
        .expect(400);
    });
  });

  describe('tenant izolasyonu (kural #3)', () => {
    it('satici-2 admini satici-1 carisine hareket GIREMEZ', async () => {
      const res = await http()
        .post('/v1/transactions')
        .set(auth(tokens.s2Admin!))
        .send({
          buyerAccountId: ids.a1Id,
          type: 'CREDIT',
          documentType: 'PAYMENT',
          documentDate: '2026-07-10',
          amount: '999999.00',
        })
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('satici-2 admini satici-1 hareketini goremez ve iptal edemez', async () => {
      const tx = await rawPrisma.transaction.findFirstOrThrow({
        where: { sellerId: ids.seller1Id, isCancelled: false },
      });

      await http().get(`/v1/transactions/${tx.id}`).set(auth(tokens.s2Admin!)).expect(404);
      await http()
        .post(`/v1/transactions/${tx.id}/cancel`)
        .set(auth(tokens.s2Admin!))
        .send({ reason: 'sabotaj' })
        .expect(404);

      const untouched = await rawPrisma.transaction.findUniqueOrThrow({ where: { id: tx.id } });
      expect(untouched.isCancelled).toBe(false);
    });

    it('satici-2 admininin hareket listesi satici-1 kayitlarini ICERMEZ', async () => {
      const res = await http()
        .get('/v1/transactions?limit=100')
        .set(auth(tokens.s2Admin!))
        .expect(200);

      const accountIds = new Set(
        res.body.data.map((t: { buyerAccountId: string }) => t.buyerAccountId),
      );
      expect(accountIds.has(ids.a1Id)).toBe(false);
      expect([...accountIds]).toEqual([ids.b1Id]);
    });

    it('alici baska carinin hareketlerini sorgulayamaz (filtre gormezden gelinir)', async () => {
      const res = await http()
        .get(`/v1/transactions?buyerAccountId=${ids.a2Id}&limit=100`)
        .set(auth(tokens.buyer1!))
        .expect(200);

      const accountIds = new Set(
        res.body.data.map((t: { buyerAccountId: string }) => t.buyerAccountId),
      );
      expect([...accountIds]).toEqual([ids.a1Id]); // kendi carisi — istedigi degil
    });

    it('alici hareket giremez (rol kapisi)', async () => {
      await http()
        .post('/v1/transactions')
        .set(auth(tokens.buyer1!))
        .send({
          buyerAccountId: ids.a1Id,
          type: 'CREDIT',
          documentType: 'PAYMENT',
          documentDate: '2026-07-10',
          amount: '10000.00',
        })
        .expect(403);
    });
  });
});
