import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_PASSWORD, USERS, createTestApp, loadSeedIds, rawPrisma } from './setup/test-app';

/**
 * §11.6 (KVKK) / §6.2 — hesap silme = ANONIMLESTIRME. Kimlik silinir ama finansal kayitlar
 * satici defterinde kalir (yasal saklama). Kural #4: finansal kayit hard delete edilmez.
 */
const EMAIL = 'silme-e2e@carinet.local';

describe('Hesap silme / anonimlestirme (e2e §11.6)', () => {
  let app: INestApplication;
  let userId: string;
  let accountId: string;
  let membershipId: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    const seed = await loadSeedIds();
    const src = await rawPrisma.user.findFirstOrThrow({ where: { email: USERS.buyer1 } });

    await rawPrisma.accountMembership.deleteMany({ where: { user: { email: EMAIL } } });
    await rawPrisma.user.deleteMany({ where: { email: EMAIL } });
    const account = await rawPrisma.buyerAccount.upsert({
      where: { sellerId_accountCode: { sellerId: seed.seller1Id, accountCode: 'TEST-DEL' } },
      create: {
        sellerId: seed.seller1Id,
        accountCode: 'TEST-DEL',
        title: 'Silme Test Cari',
        creditLimit: '0',
      },
      update: {},
    });
    accountId = account.id;
    const user = await rawPrisma.user.create({
      data: {
        email: EMAIL,
        phone: '+905551112233',
        fullName: 'Silme Test',
        passwordHash: src.passwordHash,
      },
    });
    userId = user.id;
    const membership = await rawPrisma.accountMembership.create({
      data: { userId: user.id, buyerAccountId: account.id },
    });
    membershipId = membership.id;

    // Finansal iz: bu hareket silmeden SONRA da durmali (yasal saklama).
    await rawPrisma.transaction.create({
      data: {
        sellerId: seed.seller1Id,
        buyerAccountId: account.id,
        type: 'DEBIT',
        documentType: 'SALES_INVOICE',
        documentDate: new Date('2026-01-15'),
        amount: '1500.00',
        currencyCode: 'TRY',
        exchangeRate: '1',
        description: 'Silme oncesi fatura',
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  const login = () => http().post('/v1/auth/login').send({ email: EMAIL, password: SEED_PASSWORD });

  it('yanlis parola ile silme reddedilir', async () => {
    const token = (await login().expect(200)).body.data.tokens.accessToken;
    await http()
      .delete('/v1/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'yanlis', confirm: 'HESABIMI SIL' })
      .expect(401);
  });

  it('acik onay olmadan silme VALIDATION_ERROR', async () => {
    const token = (await login().expect(200)).body.data.tokens.accessToken;
    const res = await http()
      .delete('/v1/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: SEED_PASSWORD })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('silme: kimlik anonimlestirilir, uyelik kalkar, oturumlar iptal olur', async () => {
    const loginRes = await login().expect(200);
    const token = loginRes.body.data.tokens.accessToken;
    const refreshToken = loginRes.body.data.tokens.refreshToken;

    await http()
      .delete('/v1/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: SEED_PASSWORD, confirm: 'HESABIMI SIL' })
      .expect(200);

    // Kimlik anonimlestirildi.
    const user = await rawPrisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.email).toBeNull();
    expect(user.phone).toBeNull();
    expect(user.fullName).not.toBe('Silme Test');
    expect(user.isActive).toBe(false);
    expect(user.anonymizedAt).not.toBeNull();

    // Uyelik kaldirildi.
    const membership = await rawPrisma.accountMembership.findUnique({
      where: { id: membershipId },
    });
    expect(membership).toBeNull();

    // Oturum iptal → refresh calismaz.
    await http().post('/v1/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('finansal kayit DEFTERDE KALIR (kural #4, yasal saklama)', async () => {
    const txns = await rawPrisma.transaction.findMany({ where: { buyerAccountId: accountId } });
    expect(txns).toHaveLength(1);
    expect(txns[0]!.amount.toString()).toBe('1500');
  });
});
