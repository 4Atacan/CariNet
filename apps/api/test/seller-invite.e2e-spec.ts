import { createHash, randomBytes } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { authenticator } from 'otplib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, loadSeedIds, rawPrisma } from './setup/test-app';

/**
 * Satici yoneticisi daveti (onboarding kilidi).
 *
 * Kilit neydi: prod'da SELLER_ADMIN 2FA'siz giris YAPAMAZ (kural #11), ama 2FA kurulum ucu
 * giris yapmis olmayi ister → yeni yonetici hicbir zaman iceri giremez. Bu akis kilidi acar
 * ve kritik ozelligi sudur: hesap ancak TOTP kodu dogrulandiktan SONRA olusur, dolayisiyla
 * 2FA'siz bir SELLER_ADMIN hicbir an var olmaz.
 */
const EMAIL = 'seller-invite-e2e@carinet.local';
const PASSWORD = 'Gecerli-Parola-2026!';
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

describe('Satici daveti — onboarding kilidi (e2e)', () => {
  let app: INestApplication;
  let sellerId: string;
  const http = () => request(app.getHttpServer());

  /** Davet satirini dogrudan yazariz: uc PLATFORM_ADMIN ister, seed'de oyle bir kullanici yok. */
  const makeInvite = async (opts: { expiresAt?: Date; role?: 'ADMIN' | 'STAFF' } = {}) => {
    const token = randomBytes(24).toString('base64url');
    await rawPrisma.invite.create({
      data: {
        sellerId,
        role: opts.role ?? 'ADMIN',
        tokenHash: sha256(token),
        expiresAt: opts.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return token;
  };

  beforeAll(async () => {
    app = await createTestApp();
    const seed = await loadSeedIds();
    sellerId = seed.seller1Id;
    await rawPrisma.sellerMember.deleteMany({ where: { user: { email: EMAIL } } });
    await rawPrisma.user.deleteMany({ where: { email: EMAIL } });
    await rawPrisma.invite.deleteMany({ where: { role: { not: null } } });
  });

  afterAll(async () => {
    await rawPrisma.sellerMember.deleteMany({ where: { user: { email: EMAIL } } });
    await rawPrisma.user.deleteMany({ where: { email: EMAIL } });
    await rawPrisma.invite.deleteMany({ where: { role: { not: null } } });
    await app.close();
    await rawPrisma.$disconnect();
  });

  it('davet ile hesap acilir ve 2FA AKTIF dogar', async () => {
    const token = await makeInvite();

    const start = await http()
      .post('/v1/auth/seller-invite/start')
      .send({ token, password: PASSWORD })
      .expect(200);
    expect(start.body.data.otpauthUrl).toContain('otpauth://');
    const secret: string = start.body.data.secret;

    // 1. adimdan SONRA henuz kullanici olusmamis olmali.
    expect(await rawPrisma.user.findUnique({ where: { email: EMAIL } })).toBeNull();

    const done = await http()
      .post('/v1/auth/seller-invite/complete')
      .send({
        token,
        email: EMAIL,
        fullName: 'Davetli Yonetici',
        password: PASSWORD,
        totp: authenticator.generate(secret),
      })
      .expect(200);

    expect(done.body.data.tokens.accessToken).toBeTypeOf('string');
    // Sayi two-factor.service.ts'teki BACKUP_CODE_COUNT'tan gelir; burada yalniz
    // "kodlar bir kez donuluyor mu" dogrulanir.
    expect(done.body.data.backupCodes.length).toBeGreaterThan(0);
    expect(done.body.data.backupCodes[0]).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}$/);

    const user = await rawPrisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.totpSecret).not.toBeNull();
    expect(user.totpEnabledAt).not.toBeNull();

    const member = await rawPrisma.sellerMember.findFirstOrThrow({ where: { userId: user.id } });
    expect(member.role).toBe('ADMIN');
    expect(member.sellerId).toBe(sellerId);
  });

  it('acilan hesap 2FA kodu ile giris yapabilir (kilit gercekten acildi)', async () => {
    const user = await rawPrisma.user.findUniqueOrThrow({ where: { email: EMAIL } });

    // 2FA'siz giris denemesi: TOTP zorunlulugu isliyor.
    const noTotp = await http()
      .post('/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(401);
    expect(noTotp.body.error.code).toBe('TOTP_REQUIRED');

    const ok = await http()
      .post('/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD, totp: authenticator.generate(user.totpSecret!) })
      .expect(200);
    expect(ok.body.data.user.role).toBe('SELLER_ADMIN');
  });

  it('davet TEK kullanimliktir — ikinci kez tuketilemez', async () => {
    const token = await makeInvite();
    const start = await http()
      .post('/v1/auth/seller-invite/start')
      .send({ token, password: PASSWORD })
      .expect(200);

    const body = {
      token,
      email: 'ikinci-kullanim@carinet.local',
      fullName: 'Ikinci',
      password: PASSWORD,
      totp: authenticator.generate(start.body.data.secret),
    };
    await http().post('/v1/auth/seller-invite/complete').send(body).expect(200);

    const again = await http().post('/v1/auth/seller-invite/complete').send(body).expect(400);
    expect(again.body.error.code).toBe('INVITE_INVALID');

    await rawPrisma.sellerMember.deleteMany({
      where: { user: { email: 'ikinci-kullanim@carinet.local' } },
    });
    await rawPrisma.user.deleteMany({ where: { email: 'ikinci-kullanim@carinet.local' } });
  });

  it('suresi dolmus davet reddedilir', async () => {
    const token = await makeInvite({ expiresAt: new Date(Date.now() - 1000) });
    const res = await http()
      .post('/v1/auth/seller-invite/start')
      .send({ token, password: PASSWORD })
      .expect(410);
    expect(res.body.error.code).toBe('INVITE_EXPIRED');
  });

  it('yanlis TOTP kodu hesabi ACMAZ', async () => {
    const token = await makeInvite();
    await http()
      .post('/v1/auth/seller-invite/start')
      .send({ token, password: PASSWORD })
      .expect(200);

    const res = await http()
      .post('/v1/auth/seller-invite/complete')
      .send({
        token,
        email: 'yanlis-kod@carinet.local',
        fullName: 'Yanlis Kod',
        password: PASSWORD,
        totp: '000000',
      })
      .expect(401);
    expect(res.body.error.code).toBe('TOTP_INVALID');
    expect(
      await rawPrisma.user.findUnique({ where: { email: 'yanlis-kod@carinet.local' } }),
    ).toBeNull();
  });

  it('alici davet ucu satici davetini kabul ETMEZ (turler karismaz)', async () => {
    const token = await makeInvite();
    const seller = await rawPrisma.seller.findUniqueOrThrow({ where: { id: sellerId } });
    const res = await http()
      .post('/v1/auth/accept-invite')
      .send({
        sellerSlug: seller.slug,
        token,
        email: 'karisik@carinet.local',
        fullName: 'Karisik',
        password: PASSWORD,
      })
      .expect(400);
    expect(res.body.error.code).toBe('INVITE_INVALID');
  });

  describe('parola degistirme (§11.1)', () => {
    const NEW_PASSWORD = 'Yeni-Gecerli-Parola-2026!';

    /** Davetle acilan hesap 2FA'li → giris icin TOTP sart. */
    const loginToken = async (password: string) => {
      const user = await rawPrisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
      const res = await http()
        .post('/v1/auth/login')
        .send({ email: EMAIL, password, totp: authenticator.generate(user.totpSecret!) })
        .expect(200);
      return res.body.data.tokens.accessToken as string;
    };

    it('yanlis mevcut parola reddedilir', async () => {
      const token = await loginToken(PASSWORD);
      const res = await http()
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'tamamen-yanlis', newPassword: NEW_PASSWORD })
        .expect(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('parola degisir ve ESKI parola artik calismaz', async () => {
      const token = await loginToken(PASSWORD);
      await http()
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(200);

      const user = await rawPrisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
      const eski = await http()
        .post('/v1/auth/login')
        .send({ email: EMAIL, password: PASSWORD, totp: authenticator.generate(user.totpSecret!) })
        .expect(401);
      expect(eski.body.error.code).toBe('INVALID_CREDENTIALS');

      // Yeni parola calismali (ve sonraki testler icin geri alalim).
      await loginToken(NEW_PASSWORD);
      const back = await loginToken(NEW_PASSWORD);
      await http()
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${back}`)
        .send({ currentPassword: NEW_PASSWORD, newPassword: PASSWORD })
        .expect(200);
    });

    it('oturum acmadan cagrilamaz', async () => {
      await http()
        .post('/v1/auth/change-password')
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(401);
    });
  });
});
