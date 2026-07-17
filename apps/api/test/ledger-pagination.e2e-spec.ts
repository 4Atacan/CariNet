import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_PASSWORD, USERS, createTestApp, loadSeedIds, rawPrisma } from './setup/test-app';

/**
 * §6.4 — ekstre sayfalamasi ile yuruyen bakiye.
 *
 * Sorgu sayfayi ayri, sayfa oncesi bakiyeyi ("opening") ayri hesaplar; sinir sayfanin en eski
 * satirinin (document_date, id) DEMETI'dir. Demet yerine ayri MIN(document_date)/MIN(id) kullanilirsa
 * sinir kayar — ama bu YALNIZCA ayni gune birden fazla hareket dustugunde ve o grup sayfa sinirini
 * boldugunde gorunur. Tarihleri benzersiz bir caride hata sessiz kalir.
 *
 * Bu yuzden buradaki cari KASITLI olarak ayni tarihe yigilmis hareketlerden kurulur; sayfa boyu da
 * o yigini ortadan bolecek sekilde secilir.
 */
const ACCOUNT_CODE = 'TEST-PAGE';
const TIED_DATE = new Date('2026-03-10T00:00:00.000Z');
const OTHER_DATE = new Date('2026-03-11T00:00:00.000Z');

describe('Ekstre sayfalamasi — yuruyen bakiye (e2e §6.4)', () => {
  let app: INestApplication;
  let accountId: string;
  let token: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    const seed = await loadSeedIds();

    const account = await rawPrisma.buyerAccount.upsert({
      where: { sellerId_accountCode: { sellerId: seed.seller1Id, accountCode: ACCOUNT_CODE } },
      create: {
        sellerId: seed.seller1Id,
        accountCode: ACCOUNT_CODE,
        title: 'Sayfalama Test Cari',
        creditLimit: '0',
      },
      update: {},
    });
    accountId = account.id;
    await rawPrisma.transaction.deleteMany({ where: { buyerAccountId: accountId } });

    // ID'ler KASITLI olarak elle verilir. Varsayilan cuid'ler ekleme sirasina gore artar; o zaman
    // sayfanin MIN(id)'si tesadufen sinir satiriyla ayni cikar ve hatali kurgu da dogru sonuc verir
    // (test yanlis yere yesil yanar). Hatanin gorunmesi icin DAHA YENI tarihli satirin id'si daha
    // KUCUK olmali → 'tp-aaa-*' (ertesi gun) < 'tp-tied-*' (ayni gun yigini).
    await rawPrisma.transaction.createMany({
      data: [
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `tp-tied-${i + 1}`,
          sellerId: seed.seller1Id,
          buyerAccountId: accountId,
          type: 'DEBIT' as const,
          documentType: 'SALES_INVOICE' as const,
          documentDate: TIED_DATE,
          amount: `${(i + 1) * 100}.00`,
          currencyCode: 'TRY',
          exchangeRate: '1',
          description: `Ayni gun ${i + 1}`,
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          id: `tp-aaa-${i + 1}`,
          sellerId: seed.seller1Id,
          buyerAccountId: accountId,
          type: 'CREDIT' as const,
          documentType: 'PAYMENT' as const,
          documentDate: OTHER_DATE,
          amount: '250.00',
          currencyCode: 'TRY',
          exchangeRate: '1',
          description: `Ertesi gun ${i + 1}`,
        })),
      ],
    });

    const login = await http()
      .post('/v1/auth/login')
      .send({ email: USERS.seller1Admin, password: SEED_PASSWORD });
    token = login.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    // Sira-bagimsizlik: tenant sayim testi satici-1'de tam 3 cari bekler.
    await rawPrisma.transaction.deleteMany({ where: { buyerAccountId: accountId } });
    await rawPrisma.buyerAccount.deleteMany({ where: { id: accountId } });
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('ayni tarihli hareketler sayfa sinirini bolse de yuruyen bakiye DEGISMEZ', async () => {
    const all = await http()
      .get(`/v1/buyers/${accountId}/statement?limit=100`)
      .set(auth())
      .expect(200);

    expect(all.body.data).toHaveLength(10);
    const expected: Record<string, string> = {};
    for (const row of all.body.data) expected[row.id] = row.runningBalance;

    // Sayfa boyu 3: ayni tarihli 8'li yigin 3-3-2 diye bolunur → sinir yiginin ORTASINA duser.
    const limit = 3;
    for (let page = 1; page <= 4; page += 1) {
      const res = await http()
        .get(`/v1/buyers/${accountId}/statement?limit=${limit}&page=${page}`)
        .set(auth())
        .expect(200);

      for (const row of res.body.data) {
        expect(row.runningBalance, `sayfa ${page}, satir ${row.id}`).toBe(expected[row.id]);
      }
    }
  });

  it('en yeni satirin yuruyen bakiyesi toplam bakiyeye esittir', async () => {
    const res = await http()
      .get(`/v1/buyers/${accountId}/statement?limit=1`)
      .set(auth())
      .expect(200);

    // 8 borc: 100+200+...+800 = 3600. 2 alacak: 2 x 250 = 500. Bakiye = 3100.
    expect(res.body.data[0].runningBalance).toBe('3100.00');
  });
});
