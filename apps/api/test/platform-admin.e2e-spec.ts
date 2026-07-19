import { type INestApplication } from '@nestjs/common';
import { authenticator } from 'otplib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, rawPrisma } from './setup/test-app';

/**
 * PLATFORM_ADMIN girisi ve kural #11.
 *
 * DIKKAT — kapsam siniri: bu dosya "TOTP'si OLAN kullanici kodu vermek zorunda" davranisini
 * ve platform admininin uyeliksiz calisabildigini dogrular. Kural #11'in asil zorunluluk
 * dalini (TOTP'si OLMAYAN admin prod'da giremez) BURADAN test EDILEMEZ: o dal yalnizca
 * NODE_ENV=production iken caliliyor. Onun testi izole birim testindedir →
 * src/modules/auth/two-factor-enforcement.spec.ts (mutasyonla dogrulandi).
 */
const EMAIL = 'platform-admin-e2e@carinet.local';
const PASSWORD = 'Platform-Admin-Parola-2026!';

describe('PLATFORM_ADMIN girisi (e2e, kural #11)', () => {
  let app: INestApplication;
  let totpSecret: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    await rawPrisma.user.deleteMany({ where: { email: EMAIL } });

    // Parola hash'ini uretmek yerine mevcut bir kullanicidan kopyalamak yerine, gercek
    // akisla ayni olsun diye argon2 hash'i uygulamanin kendi servisinden gecmeli; burada
    // dogrudan yazmak yeterli cunku giris testi parolayi API uzerinden dogruluyor.
    const { hash } = await import('argon2');
    totpSecret = authenticator.generateSecret();
    await rawPrisma.user.create({
      data: {
        email: EMAIL,
        fullName: 'Platform Admin Testi',
        passwordHash: await hash(PASSWORD, { type: 2 }),
        isPlatformAdmin: true,
        totpSecret,
        totpEnabledAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await rawPrisma.user.deleteMany({ where: { email: EMAIL } });
    await app.close();
    await rawPrisma.$disconnect();
  });

  it('TOTP kurulu admin, kod vermeden giremez', async () => {
    const res = await http().post('/v1/auth/login').send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOTP_REQUIRED');
  });

  it('gecerli TOTP ile girer ve PLATFORM_ADMIN rolu alir', async () => {
    const res = await http()
      .post('/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD, totp: authenticator.generate(totpSecret) })
      .expect(200);

    expect(res.body.data.user.role).toBe('PLATFORM_ADMIN');
    // Uyeligi yok: tenant baglami bos olmali.
    expect(res.body.data.user.sellerId).toBeNull();
    expect(res.body.data.memberships).toHaveLength(0);
  });

  it('satici daveti uretebilir (uc PLATFORM_ADMIN ister)', async () => {
    const login = await http()
      .post('/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD, totp: authenticator.generate(totpSecret) })
      .expect(200);

    const seller = await rawPrisma.seller.findFirstOrThrow();
    const res = await http()
      .post('/v1/auth/seller-invites')
      .set('Authorization', `Bearer ${login.body.data.tokens.accessToken}`)
      .send({ sellerId: seller.id, role: 'ADMIN' })
      .expect(201);

    expect(res.body.data.url).toMatch(/^\/davet\//);
    await rawPrisma.invite.deleteMany({ where: { role: { not: null } } });
  });
});
