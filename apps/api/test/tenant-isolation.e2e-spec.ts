import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  SEED_PASSWORD,
  USERS,
  type SeedIds,
  createTestApp,
  decodeJwt,
  loadSeedIds,
  rawPrisma,
} from './setup/test-app';

/**
 * CLAUDE.md kural #3 + Faz 0 bitti kriteri:
 * "iki saticinin kullanicilariyla giris; A→B verisine erisemiyor (test kanitli)".
 */
describe('Tenant izolasyonu (e2e) — kural #3', () => {
  let app: INestApplication;
  let ids: SeedIds;
  const tokens: Record<string, string> = {};

  const http = () => request(app.getHttpServer());

  const login = async (email: string): Promise<string> => {
    const res = await http()
      .post('/v1/auth/login')
      .send({ email, password: SEED_PASSWORD })
      .expect(200);
    return res.body.data.tokens.accessToken;
  };

  beforeAll(async () => {
    app = await createTestApp();
    ids = await loadSeedIds();
    tokens.s1Admin = await login(USERS.seller1Admin);
    tokens.s2Admin = await login(USERS.seller2Admin);
    tokens.buyer1 = await login(USERS.buyer1);
    tokens.buyerMulti = await login(USERS.buyerMulti);
  });

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  const get = (path: string, token: string) =>
    http().get(path).set('Authorization', `Bearer ${token}`);

  describe('satici → satici', () => {
    it('satici-1 admini YALNIZ kendi carilerini listeler', async () => {
      const res = await get('/v1/buyers', tokens.s1Admin!).expect(200);

      const returnedIds = res.body.data.map((b: { id: string }) => b.id);
      expect(returnedIds).toHaveLength(3);
      expect(returnedIds).toEqual(expect.arrayContaining([ids.a1Id, ids.a2Id, ids.a3Id]));
      expect(returnedIds).not.toContain(ids.b1Id); // satici-2'nin carisi ASLA gorunmez
      expect(res.body.meta.total).toBe(3);
    });

    it('satici-2 admini yalniz kendi tek carisini listeler', async () => {
      const res = await get('/v1/buyers', tokens.s2Admin!).expect(200);
      expect(res.body.data.map((b: { id: string }) => b.id)).toEqual([ids.b1Id]);
    });

    it('A saticisi B saticisinin carisini ID ile de goremez (IDOR)', async () => {
      const res = await get(`/v1/buyers/${ids.b1Id}`, tokens.s1Admin!).expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('B saticisi A saticisinin carisini ID ile de goremez (ters yon)', async () => {
      const res = await get(`/v1/buyers/${ids.a1Id}`, tokens.s2Admin!).expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('satici kendi carisini gorebilir (kontrol grubu — filtre asiri kisitlamiyor)', async () => {
      const res = await get(`/v1/buyers/${ids.a1Id}`, tokens.s1Admin!).expect(200);
      expect(res.body.data.id).toBe(ids.a1Id);
      expect(res.body.data.title).toBe('Bakkalim Gida Ltd.');
    });
  });

  describe('alici → alici (ayni satici icinde yatay yetki)', () => {
    it('alici kendi carisini gorur', async () => {
      const payload = decodeJwt(tokens.buyer1!);
      const res = await get(
        `/v1/buyers/${payload.buyerAccountId as string}`,
        tokens.buyer1!,
      ).expect(200);
      expect(res.body.data.id).toBe(ids.a1Id);
    });

    it('alici ayni saticidaki BASKA cariyi goremez', async () => {
      const res = await get(`/v1/buyers/${ids.a2Id}`, tokens.buyer1!).expect(403);
      expect(res.body.error.code).toBe('TENANT_FORBIDDEN');
    });

    it('alici cari listeleme ucuna giremez (rol kapisi)', async () => {
      const res = await get('/v1/buyers', tokens.buyer1!).expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('coklu uyelikli kullanici — aktif baglam ne diyorsa o (§6.2)', () => {
    it('satici-1 baglamindayken satici-2 carisini goremez', async () => {
      const payload = decodeJwt(tokens.buyerMulti!);
      expect(payload.sellerId).toBe(ids.seller1Id);

      await get(`/v1/buyers/${ids.b1Id}`, tokens.buyerMulti!).expect(403);
      await get(`/v1/buyers/${ids.a3Id}`, tokens.buyerMulti!).expect(200);
    });

    it('switch-account sonrasi TAM TERSI gecerli olur', async () => {
      const memberships = await http()
        .get('/v1/auth/memberships')
        .set('Authorization', `Bearer ${tokens.buyerMulti}`)
        .expect(200);

      const seller2Membership = memberships.body.data.find(
        (m: { sellerId: string }) => m.sellerId === ids.seller2Id,
      );

      const switched = await http()
        .post('/v1/auth/switch-account')
        .set('Authorization', `Bearer ${tokens.buyerMulti}`)
        .send({ membershipId: seller2Membership.membershipId })
        .expect(200);

      const s2Token = switched.body.data.tokens.accessToken;
      expect(decodeJwt(s2Token).sellerId).toBe(ids.seller2Id);

      await get(`/v1/buyers/${ids.b1Id}`, s2Token).expect(200); // artik goruyor
      await get(`/v1/buyers/${ids.a3Id}`, s2Token).expect(403); // eski baglam kapandi
    });
  });

  describe('Prisma tenant guard eklentisi (3. kemer)', () => {
    it('tenant baglami olmadan tenant modeline sorgu ATILAMAZ', async () => {
      const { PRISMA } = await import('../src/prisma/prisma.module');
      const prisma = app.get<typeof rawPrisma>(PRISMA);

      // TenantContext bos → eklenti sorguyu reddetmeli (sessizce tum kiracilari DONMEMELI).
      await expect(prisma.buyerAccount.findMany()).rejects.toThrow(/Tenant ihlali/);
    });
  });
});
