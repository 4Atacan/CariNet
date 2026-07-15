import { type INestApplication } from '@nestjs/common';
import { authenticator } from 'otplib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_PASSWORD, USERS, createTestApp, loadSeedIds, rawPrisma } from './setup/test-app';

/**
 * §11.1 — 2FA enrollment uctan uca. Ayrilmis izole bir kullaniciyla calisilir:
 * seed hesaplarina dokunmadigimiz icin dosya sirasindan bagimsiz (fileParallelism: false).
 */
const EMAIL = 'twofa-e2e@carinet.local';

describe('2FA kurulumu ve giris (e2e §11.1)', () => {
  let app: INestApplication;
  let secret: string;
  let backupCodes: string[];
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    const seed = await loadSeedIds();
    const src = await rawPrisma.user.findFirstOrThrow({ where: { email: USERS.buyer1 } });

    await rawPrisma.accountMembership.deleteMany({ where: { user: { email: EMAIL } } });
    await rawPrisma.user.deleteMany({ where: { email: EMAIL } });
    const account = await rawPrisma.buyerAccount.upsert({
      where: { sellerId_accountCode: { sellerId: seed.seller1Id, accountCode: 'TEST-2FA' } },
      create: {
        sellerId: seed.seller1Id,
        accountCode: 'TEST-2FA',
        title: '2FA Test Cari',
        creditLimit: '0',
      },
      update: {},
    });
    // Ayni SEED_PASSWORD'un argon2 hash'ini kopyalariz (yeni hash uretmeye gerek yok).
    const user = await rawPrisma.user.create({
      data: { email: EMAIL, fullName: '2FA Test', passwordHash: src.passwordHash },
    });
    await rawPrisma.accountMembership.create({
      data: { userId: user.id, buyerAccountId: account.id },
    });
  });

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  const login = (extra: Record<string, unknown> = {}) =>
    http()
      .post('/v1/auth/login')
      .send({ email: EMAIL, password: SEED_PASSWORD, ...extra });

  const accessToken = async () => (await login().expect(200)).body.data.tokens.accessToken;

  it('setup: parola dogrulanir, aday secret + otpauth URL doner', async () => {
    const token = await accessToken();
    const res = await http()
      .post('/v1/auth/2fa/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: SEED_PASSWORD })
      .expect(200);
    secret = res.body.data.secret;
    expect(secret.length).toBeGreaterThan(0);
    expect(res.body.data.otpauthUrl).toContain('otpauth://totp/');
  });

  it('yanlis parola ile setup reddedilir', async () => {
    const token = await accessToken();
    await http()
      .post('/v1/auth/2fa/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'yanlis-sifre' })
      .expect(401);
  });

  it('enable: gecerli kodla 2FA acilir ve 10 yedek kod doner (tek seferlik)', async () => {
    const token = await accessToken();
    const res = await http()
      .post('/v1/auth/2fa/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({ totp: authenticator.generate(secret) })
      .expect(200);
    backupCodes = res.body.data.backupCodes;
    expect(backupCodes).toHaveLength(10);
  });

  it('2FA aciksa giris TOTP ister', async () => {
    const res = await login().expect(401);
    expect(res.body.error.code).toBe('TOTP_REQUIRED');
  });

  it('gecersiz TOTP reddedilir', async () => {
    const res = await login({ totp: '000000' }).expect(401);
    expect(res.body.error.code).toBe('TOTP_INVALID');
  });

  it('gecerli TOTP ile giris yapilir', async () => {
    await login({ totp: authenticator.generate(secret) }).expect(200);
  });

  it('yedek kod ile giris yapilir ve kod TUKENIR (tek kullanimlik)', async () => {
    const code = backupCodes[0]!;
    await login({ recoveryCode: code }).expect(200);
    const reuse = await login({ recoveryCode: code }).expect(401);
    expect(reuse.body.error.code).toBe('TOTP_INVALID');
  });

  it('disable: parola + gecerli kod ile kapanir, giris tekrar kodsuz calisir', async () => {
    const token = (await login({ totp: authenticator.generate(secret) }).expect(200)).body.data
      .tokens.accessToken;
    await http()
      .post('/v1/auth/2fa/disable')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: SEED_PASSWORD, totp: authenticator.generate(secret) })
      .expect(200);
    await login().expect(200);
  });
});
