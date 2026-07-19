import { type INestApplication } from '@nestjs/common';
import { authenticator } from 'otplib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_PASSWORD, USERS, createTestApp, rawPrisma } from './setup/test-app';

/**
 * Platform yonetimi uclari (§0 platform admin) ve KURAL #3 siniri.
 *
 * Bu uclar tenant filtresini bilerek atlar (`runAsSystem`), cunku platform admininin uyeligi
 * yoktur. Tam da bu yuzden en kritik test "kim ULASAMAZ" olanidir: satici admini, satici
 * personeli ve alici bu uclara girememeli. Girebilseydi izolasyon tek bir rolun arkasinda
 * erirdi.
 */
const EMAIL = 'platform-sellers-e2e@carinet.local';
const PASSWORD = 'Platform-Sellers-2026!';
const SLUG = 'e2e-yeni-satici';

describe('Platform yonetimi uclari (e2e)', () => {
  let app: INestApplication;
  let totpSecret: string;
  let adminToken: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    await rawPrisma.user.deleteMany({ where: { email: EMAIL } });
    await rawPrisma.seller.deleteMany({ where: { slug: SLUG } });

    const { hash } = await import('argon2');
    totpSecret = authenticator.generateSecret();
    await rawPrisma.user.create({
      data: {
        email: EMAIL,
        fullName: 'Platform Yonetici',
        passwordHash: await hash(PASSWORD, { type: 2 }),
        isPlatformAdmin: true,
        totpSecret,
        totpEnabledAt: new Date(),
      },
    });

    const login = await http()
      .post('/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD, totp: authenticator.generate(totpSecret) })
      .expect(200);
    adminToken = login.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await rawPrisma.invite.deleteMany({ where: { seller: { slug: SLUG } } });
    await rawPrisma.seller.deleteMany({ where: { slug: SLUG } });
    await rawPrisma.user.deleteMany({ where: { email: EMAIL } });
    await app.close();
    await rawPrisma.$disconnect();
  });

  const asAdmin = (m: 'get' | 'post' | 'patch', url: string) =>
    http()[m](url).set('Authorization', `Bearer ${adminToken}`);

  it('satici listesini gorur (uye ve cari sayilariyla)', async () => {
    const res = await asAdmin('get', '/v1/platform/sellers').expect(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2); // seed'de 2 satici
    expect(res.body.data[0]).toHaveProperty('memberCount');
    expect(res.body.data[0]).toHaveProperty('buyerCount');
  });

  it('yeni satici olusturur', async () => {
    const res = await asAdmin('post', '/v1/platform/sellers')
      .send({ name: 'E2E Yeni Satici', slug: SLUG })
      .expect(201);
    expect(res.body.data.slug).toBe(SLUG);
    expect(res.body.data.sellerNo).toBeTypeOf('number');
  });

  it('ayni slug ikinci kez kabul edilmez', async () => {
    const res = await asAdmin('post', '/v1/platform/sellers')
      .send({ name: 'Kopya', slug: SLUG })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('gecersiz slug reddedilir (misafir odeme adresinde gorunur)', async () => {
    await asAdmin('post', '/v1/platform/sellers')
      .send({ name: 'Bosluklu', slug: 'Buyuk Harf Ve Bosluk' })
      .expect(400);
  });

  it('olusturulan satici icin davet uretir ve bekleyenlerde gorunur', async () => {
    const seller = await rawPrisma.seller.findUniqueOrThrow({ where: { slug: SLUG } });

    const invite = await asAdmin('post', '/v1/auth/seller-invites')
      .send({ sellerId: seller.id, role: 'ADMIN' })
      .expect(201);
    expect(invite.body.data.url).toMatch(/^\/davet\//);

    const open = await asAdmin('get', `/v1/platform/sellers/${seller.id}/invites`).expect(200);
    expect(open.body.data).toHaveLength(1);
    expect(open.body.data[0].role).toBe('ADMIN');
  });

  // --- KURAL #3 siniri: bu uclar tenant kullanicilarina KAPALI -------------------------
  describe('yetki siniri (kural #3)', () => {
    const loginAs = async (email: string) => {
      const res = await http()
        .post('/v1/auth/login')
        .send({ email, password: SEED_PASSWORD })
        .expect(200);
      return res.body.data.tokens.accessToken as string;
    };

    it('satici admini platform uclarina ULASAMAZ', async () => {
      const token = await loginAs(USERS.seller1Admin);
      await http().get('/v1/platform/sellers').set('Authorization', `Bearer ${token}`).expect(403);
      await http()
        .post('/v1/platform/sellers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Sizinti', slug: 'sizinti' })
        .expect(403);
    });

    it('alici kullanicisi platform uclarina ULASAMAZ', async () => {
      const token = await loginAs(USERS.buyer1);
      await http().get('/v1/platform/sellers').set('Authorization', `Bearer ${token}`).expect(403);
    });

    it('oturumsuz erisim 401', async () => {
      await http().get('/v1/platform/sellers').expect(401);
    });

    it('satici admini davet URETEMEZ (tenant sinirini asamaz)', async () => {
      const token = await loginAs(USERS.seller1Admin);
      const seller = await rawPrisma.seller.findUniqueOrThrow({ where: { slug: SLUG } });
      await http()
        .post('/v1/auth/seller-invites')
        .set('Authorization', `Bearer ${token}`)
        .send({ sellerId: seller.id, role: 'ADMIN' })
        .expect(403);
    });
  });
});
