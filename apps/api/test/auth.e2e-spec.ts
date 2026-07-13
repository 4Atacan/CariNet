import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_PASSWORD, USERS, createTestApp, decodeJwt, rawPrisma } from './setup/test-app';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  const login = (email: string, password = SEED_PASSWORD) =>
    http().post('/v1/auth/login').send({ email, password });

  describe('giris', () => {
    it('satici admini giris yapar ve zarf sozlesmesine uyar (§10)', async () => {
      const res = await login(USERS.seller1Admin).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens.accessToken).toBeTypeOf('string');
      expect(res.body.data.user.role).toBe('SELLER_ADMIN');

      const payload = decodeJwt(res.body.data.tokens.accessToken);
      expect(payload.sellerId).toBeTypeOf('string');
      expect(payload.buyerAccountId).toBeNull();
    });

    it('alici kullanicisi BUYER_USER rolu ve cari baglami alir', async () => {
      const res = await login(USERS.buyer1).expect(200);
      const payload = decodeJwt(res.body.data.tokens.accessToken);
      expect(payload.role).toBe('BUYER_USER');
      expect(payload.buyerAccountId).toBeTypeOf('string');
    });

    it('yanlis sifre INVALID_CREDENTIALS dondurur', async () => {
      const res = await login(USERS.seller1Admin, 'yanlis-sifre').expect(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('olmayan kullanici da AYNI hatayi dondurur (kullanici var/yok sizdirilmaz)', async () => {
      const res = await login('yok@carinet.local').expect(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('gecersiz govde VALIDATION_ERROR (kural #7)', async () => {
      const res = await http().post('/v1/auth/login').send({ email: 'gecersiz' }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('tokensiz korunan uc 401', async () => {
      await http().get('/v1/buyers').expect(401);
    });
  });

  describe('coklu uyelik ve hesap degistirici (§6.2)', () => {
    it('ayni kullanici iki saticida cari olabilir', async () => {
      const res = await login(USERS.buyerMulti).expect(200);
      const memberships = res.body.data.memberships;
      expect(memberships).toHaveLength(2);
      expect(new Set(memberships.map((m: { sellerId: string }) => m.sellerId)).size).toBe(2);
    });

    it('switch-account yeni baglamla yeni token cifti uretir', async () => {
      const first = await login(USERS.buyerMulti).expect(200);
      const { accessToken } = first.body.data.tokens;
      const initialSellerId = decodeJwt(accessToken).sellerId;

      const target = first.body.data.memberships.find(
        (m: { sellerId: string }) => m.sellerId !== initialSellerId,
      );

      const res = await http()
        .post('/v1/auth/switch-account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ membershipId: target.membershipId })
        .expect(200);

      const next = decodeJwt(res.body.data.tokens.accessToken);
      expect(next.sellerId).toBe(target.sellerId);
      expect(next.sellerId).not.toBe(initialSellerId);
      expect(next.buyerAccountId).toBe(target.buyerAccountId);
    });

    it('baskasinin uyeligine gecilemez', async () => {
      const [multi, other] = await Promise.all([
        login(USERS.buyerMulti).expect(200),
        login(USERS.buyer1).expect(200),
      ]);
      const foreignMembership = other.body.data.memberships[0].membershipId;

      const res = await http()
        .post('/v1/auth/switch-account')
        .set('Authorization', `Bearer ${multi.body.data.tokens.accessToken}`)
        .send({ membershipId: foreignMembership })
        .expect(403);

      expect(res.body.error.code).toBe('MEMBERSHIP_NOT_FOUND');
    });
  });

  describe('refresh rotasyonu ve reuse tespiti (§6.3)', () => {
    it('refresh yeni cift uretir; eski token gecersizlesir', async () => {
      const { body } = await login(USERS.seller1Staff).expect(200);
      const original = body.data.tokens.refreshToken;

      const rotated = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: original })
        .expect(200);

      expect(rotated.body.data.tokens.refreshToken).not.toBe(original);
    });

    it('REUSE: iptal edilmis refresh token tekrar kullanilirsa AILE toptan iptal edilir', async () => {
      const { body } = await login(USERS.seller1Staff).expect(200);
      const original = body.data.tokens.refreshToken;

      const rotated = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: original })
        .expect(200);
      const fresh = rotated.body.data.tokens.refreshToken;

      // Eski (rotasyonda iptal edilmis) token yeniden kullaniliyor → reuse.
      const reuse = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: original })
        .expect(401);
      expect(reuse.body.error.code).toBe('TOKEN_REUSED');

      // Ailenin geri kalani da olmus olmali: taze token artik calismaz.
      const afterRevoke = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: fresh })
        .expect(401);
      expect(afterRevoke.body.error.code).toBe('TOKEN_REUSED');
    });

    it('logout sonrasi refresh calismaz', async () => {
      const { body } = await login(USERS.buyer1).expect(200);
      const refreshToken = body.data.tokens.refreshToken;

      await http().post('/v1/auth/logout').send({ refreshToken }).expect(200);
      const res = await http().post('/v1/auth/refresh').send({ refreshToken }).expect(401);
      expect(res.body.error.code).toBe('TOKEN_REUSED');
    });
  });

  describe('sifre sifirlama', () => {
    it('bilinmeyen e-posta icin de ayni yaniti verir (numaralandirma yok)', async () => {
      const res = await http()
        .post('/v1/auth/forgot-password')
        .send({ email: 'kimse@yok.com' })
        .expect(200);
      expect(res.body.data.ok).toBe(true);
    });

    it('gecersiz reset token reddedilir', async () => {
      const res = await http()
        .post('/v1/auth/reset-password')
        .send({ token: 'uydurma-token', password: 'YeniSifre2026!' })
        .expect(400);
      expect(res.body.error.code).toBe('INVITE_INVALID');
    });
  });
});
