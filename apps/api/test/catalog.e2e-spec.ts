import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DueReminderTask } from '../src/modules/notifications/due-reminder.task';
import {
  SEED_PASSWORD,
  USERS,
  type SeedIds,
  createTestApp,
  loadSeedIds,
  rawPrisma,
} from './setup/test-app';

/**
 * §13 Faz 4 bitti kriteri:
 *   (1) "vadesi yaklasan seed faturasi cron bildirimi uretiyor"
 *   (2) "kampanya push'u test cihazina HESAP BAGLAMIYLA ulasiyor"
 *
 * Push'un kendisi Expo sunucusuna gider (agdan cikis). Test, BIZIM tarafimizdaki her seyi
 * kanitlar: dogru kullanicilar, dogru hesap baglami, dogru payload, dogru rozet.
 * Expo'ya HTTP cikisi olmasin diye test cihazlarina gecerli bicimde ama kayitli olmayan
 * token verilir; gonderim best-effort'tur ve DB bildirimi her halukarda yazilir.
 */
describe('Katalog ve Iletisim (e2e)', () => {
  let app: INestApplication;
  let ids: SeedIds;
  let reminderTask: DueReminderTask;
  let dueAccountId: string; // vadesi 3 gun sonra → hatirlatma BEKLENIR
  let paidAccountId: string; // borcu odenmis → hatirlatma BEKLENMEZ
  let buyerUserId: string;
  const tokens: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const login = async (email: string): Promise<string> => {
    const res = await http().post('/v1/auth/login').send({ email, password: SEED_PASSWORD });
    return res.body.data.tokens.accessToken;
  };

  const day = (offset: number): Date => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + offset);
    return d;
  };

  beforeAll(async () => {
    app = await createTestApp();
    reminderTask = app.get(DueReminderTask);
    ids = await loadSeedIds();
    tokens.s1Admin = await login(USERS.seller1Admin);
    tokens.s2Admin = await login(USERS.seller2Admin);
    tokens.buyer1 = await login(USERS.buyer1);

    const buyer = await rawPrisma.user.findUniqueOrThrow({ where: { email: USERS.buyer1 } });
    buyerUserId = buyer.id;

    // (A) Vadesi TAM 3 GUN sonra olan fatura → DUE_SOON hatirlatmasi beklenir.
    const dueAccount = await rawPrisma.buyerAccount.create({
      data: {
        sellerId: ids.seller1Id,
        accountCode: 'HTRL-001',
        title: 'Vade Hatirlatma Cari',
        creditLimit: '50000.00',
        memberships: { create: { userId: buyerUserId } },
      },
    });
    dueAccountId = dueAccount.id;
    await rawPrisma.transaction.create({
      data: {
        sellerId: ids.seller1Id,
        buyerAccountId: dueAccount.id,
        type: 'DEBIT',
        documentType: 'SALES_INVOICE',
        documentNo: 'VADE-3GUN',
        documentDate: day(-27),
        dueDate: day(3),
        amount: '7500.00',
      },
    });

    // (B) Ayni vadeli fatura ama ODENMIS → hatirlatma GITMEMELI (FIFO ile kapanir).
    const paidAccount = await rawPrisma.buyerAccount.create({
      data: {
        sellerId: ids.seller1Id,
        accountCode: 'HTRL-002',
        title: 'Odenmis Cari',
        creditLimit: '50000.00',
        memberships: { create: { userId: buyerUserId } },
      },
    });
    paidAccountId = paidAccount.id;
    await rawPrisma.transaction.createMany({
      data: [
        {
          sellerId: ids.seller1Id,
          buyerAccountId: paidAccount.id,
          type: 'DEBIT',
          documentType: 'SALES_INVOICE',
          documentNo: 'ODENMIS',
          documentDate: day(-27),
          dueDate: day(3),
          amount: '7500.00',
        },
        {
          sellerId: ids.seller1Id,
          buyerAccountId: paidAccount.id,
          type: 'CREDIT',
          documentType: 'PAYMENT',
          documentDate: day(-1),
          amount: '7500.00',
        },
      ],
    });
  });

  afterAll(async () => {
    const accounts = [dueAccountId, paidAccountId];
    await rawPrisma.notification.deleteMany({ where: { buyerAccountId: { in: accounts } } });
    await rawPrisma.transaction.deleteMany({ where: { buyerAccountId: { in: accounts } } });
    await rawPrisma.accountMembership.deleteMany({
      where: { buyerAccountId: { in: accounts } },
    });
    await rawPrisma.buyerAccount.deleteMany({ where: { id: { in: accounts } } });
    await rawPrisma.pushToken.deleteMany({ where: { userId: buyerUserId } });
    await rawPrisma.supportRequest.deleteMany({});
    await app.close();
    await rawPrisma.$disconnect();
  });

  // ================================================================ urunler + stok

  describe('Urunler ve stoklar', () => {
    it('satici urun olusturur, acilis stogu ile', async () => {
      const res = await http().post('/v1/products').set(auth(tokens.s1Admin!)).send({
        code: 'YENI-001',
        name: 'Zeytinyagi 1L',
        unit: 'ADET',
        price: '180.00',
        quantity: '250',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.price).toBe('180.00');
      expect(res.body.data.quantity).toBe('250'); // 4 ondalik DB'de, string olarak doner
    });

    it('ayni urun kodu iki kez kullanilamaz', async () => {
      const res = await http()
        .post('/v1/products')
        .set(auth(tokens.s1Admin!))
        .send({ code: 'URN-001', name: 'Kopya', unit: 'ADET' });

      expect(res.status).toBe(409);
    });

    it('stok MUTLAK yazilir (sayim sonucu)', async () => {
      const list = await http().get('/v1/products?limit=100').set(auth(tokens.s1Admin!));
      const product = list.body.data.find((p: { code: string }) => p.code === 'URN-001');

      const res = await http()
        .patch(`/v1/products/${product.id}/stock`)
        .set(auth(tokens.s1Admin!))
        .send({ quantity: '17.5000' });

      expect(res.status).toBe(200);
      expect(Number(res.body.data.quantity)).toBe(17.5);
    });

    it('MOBIL VITRIN: alici yalniz AKTIF urunleri gorur', async () => {
      const list = await http().get('/v1/products?limit=100').set(auth(tokens.s1Admin!));
      const product = list.body.data.find((p: { code: string }) => p.code === 'YENI-001');

      await http()
        .patch(`/v1/products/${product.id}/active`)
        .set(auth(tokens.s1Admin!))
        .send({ isActive: false });

      const vitrin = await http().get('/v1/products?limit=100').set(auth(tokens.buyer1!));
      const codes = vitrin.body.data.map((p: { code: string }) => p.code);
      expect(codes).not.toContain('YENI-001');
      expect(codes).toContain('URN-001');
    });

    it('alici urun olusturamaz', async () => {
      const res = await http()
        .post('/v1/products')
        .set(auth(tokens.buyer1!))
        .send({ code: 'HACK', name: 'Olmaz', unit: 'ADET' });
      expect(res.status).toBe(403);
    });

    it('satici-2 satici-1"in urunlerini goremez (tenant)', async () => {
      const res = await http().get('/v1/products?limit=100').set(auth(tokens.s2Admin!));
      const codes = res.body.data.map((p: { code: string }) => p.code);
      expect(codes).not.toContain('URN-001');
      expect(codes).toContain('TEK-001');
    });
  });

  // ================================================================ push tokenlari

  describe('Push tokenlari (§6.2 kullanici+cihaz bazli)', () => {
    it('gecerli Expo tokeni kaydedilir', async () => {
      const res = await http()
        .post('/v1/notifications/tokens')
        .set(auth(tokens.buyer1!))
        .send({ token: 'ExponentPushToken[test-cihaz-1]', platform: 'ios', deviceName: 'iPhone' });

      expect(res.status).toBe(201);
      const saved = await rawPrisma.pushToken.findUnique({
        where: { token: 'ExponentPushToken[test-cihaz-1]' },
      });
      expect(saved?.userId).toBe(buyerUserId);
    });

    it('bozuk bicimli token reddedilir', async () => {
      const res = await http()
        .post('/v1/notifications/tokens')
        .set(auth(tokens.buyer1!))
        .send({ token: 'rastgele-bir-metin', platform: 'android' });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================ (1) VADE HATIRLATMA CRONU

  describe('Vade hatirlatma cronu (bitti kriteri 1)', () => {
    it('vadesi 3 gun sonra olan fatura icin bildirim URETIR', async () => {
      const result = await reminderTask.run();
      expect(result.reminders).toBeGreaterThan(0);

      const notification = await rawPrisma.notification.findFirst({
        where: { buyerAccountId: dueAccountId, type: 'DUE_REMINDER' },
      });

      expect(notification).toBeTruthy();
      expect(notification?.userId).toBe(buyerUserId);
      // HESAP BAGLAMI: bildirim dogru satici + dogru cari ile yazilir (§6.2).
      expect(notification?.sellerId).toBe(ids.seller1Id);
      expect(notification?.title).toBe('Vadesi yaklasan odeme');
      expect(notification?.body).toContain('VADE-3GUN');
      expect(notification?.body).toContain('3 gun');
    });

    it('BORCU ODENMIS cariye hatirlatma GITMEZ (FIFO ile kapanmis)', async () => {
      const notification = await rawPrisma.notification.findFirst({
        where: { buyerAccountId: paidAccountId, type: 'DUE_REMINDER' },
      });
      // Odemis musteriye "borcunuz var" demek en kotu hatadir.
      expect(notification).toBeNull();
    });
  });

  // ================================================================ (2) KAMPANYA PUSH'U

  describe('Kampanya duyurusu (bitti kriteri 2)', () => {
    it('kampanya push"u HESAP BAGLAMIYLA her cariye ayri ulasir', async () => {
      const campaign = await http()
        .post('/v1/campaigns')
        .set(auth(tokens.s1Admin!))
        .send({
          title: 'Yaz Kampanyasi',
          body: 'Tum yaglarda %10 indirim!',
          startsAt: day(-1).toISOString(),
          endsAt: day(30).toISOString(),
        });
      expect(campaign.status).toBe(201);

      const announce = await http()
        .post(`/v1/campaigns/${campaign.body.data.id}/announce`)
        .set(auth(tokens.s1Admin!))
        .send({});

      expect(announce.status).toBe(201);
      expect(announce.body.data.accounts).toBeGreaterThan(0);
      expect(announce.body.data.notified).toBeGreaterThan(0);

      // Alici, KENDI hesabinin baglaminda bildirim almis olmali.
      const notifications = await rawPrisma.notification.findMany({
        where: { userId: buyerUserId, type: 'CAMPAIGN' },
      });
      expect(notifications.length).toBeGreaterThan(0);

      // Coklu uyelik: her cari icin AYRI bildirim → rozet dogru hesaba duser (§6.2).
      const accountIds = notifications.map((n) => n.buyerAccountId);
      expect(new Set(accountIds).size).toBe(accountIds.length);
      expect(accountIds).toContain(ids.a1Id);
      for (const n of notifications) expect(n.sellerId).toBe(ids.seller1Id);
    });

    it('alici kampanya olusturamaz', async () => {
      const res = await http()
        .post('/v1/campaigns')
        .set(auth(tokens.buyer1!))
        .send({
          title: 'Olmaz',
          body: 'Olmaz',
          startsAt: day(0).toISOString(),
          endsAt: day(1).toISOString(),
        });
      expect(res.status).toBe(403);
    });
  });

  // ================================================================ bildirim merkezi

  describe('Bildirim merkezi (hesap bazli rozet)', () => {
    it('rozet AKTIF hesabin okunmamis bildirimlerini sayar', async () => {
      const res = await http().get('/v1/notifications/unread-count').set(auth(tokens.buyer1!));

      expect(res.status).toBe(200);
      expect(res.body.data.unread).toBeGreaterThan(0);

      // Rozet YALNIZ aktif hesabin bildirimlerini sayar — baska carinin bildirimi sizmaz.
      const all = await rawPrisma.notification.count({ where: { userId: buyerUserId } });
      const own = await rawPrisma.notification.count({
        where: { userId: buyerUserId, buyerAccountId: ids.a1Id, readAt: null },
      });
      expect(res.body.data.unread).toBe(own);
      expect(own).toBeLessThanOrEqual(all);
    });

    it('okundu isaretleme rozeti sifirlar', async () => {
      await http().post('/v1/notifications/read').set(auth(tokens.buyer1!)).send({ all: true });

      const res = await http().get('/v1/notifications/unread-count').set(auth(tokens.buyer1!));
      expect(res.body.data.unread).toBe(0);
    });
  });

  // ================================================================ talep-oneri

  describe('Talep-Oneri', () => {
    let requestId: string;

    it('alici talep acar', async () => {
      const res = await http()
        .post('/v1/requests')
        .set(auth(tokens.buyer1!))
        .send({ type: 'SUGGESTION', subject: 'Teslimat saati', body: 'Sabah teslimat olur mu?' });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('OPEN');
      requestId = res.body.data.id;
    });

    it('satici yanitlar → aliciya bildirim gider', async () => {
      const res = await http()
        .post(`/v1/requests/${requestId}/reply`)
        .set(auth(tokens.s1Admin!))
        .send({ reply: 'Sabah 09:00 teslimat yapiyoruz.', status: 'RESOLVED' });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('RESOLVED');

      const notification = await rawPrisma.notification.findFirst({
        where: { userId: buyerUserId, title: 'Talebiniz yanitlandi' },
      });
      expect(notification?.buyerAccountId).toBe(ids.a1Id);
    });

    it('satici-2 satici-1"in talebini goremez (tenant)', async () => {
      const res = await http().get('/v1/requests?limit=100').set(auth(tokens.s2Admin!));
      const idsFound = res.body.data.map((r: { id: string }) => r.id);
      expect(idsFound).not.toContain(requestId);
    });
  });

  // ================================================================ kurlar

  describe('TCMB kurlari', () => {
    it('kaydedilen kurlar listelenir ve 4 ondalikli doner', async () => {
      await rawPrisma.exchangeRate.upsert({
        where: { date_currencyCode: { date: day(0), currencyCode: 'USD' } },
        create: { date: day(0), currencyCode: 'USD', rate: '38.4210' },
        update: { rate: '38.4210' },
      });

      const res = await http().get('/v1/exchange-rates/latest').set(auth(tokens.buyer1!));
      expect(res.status).toBe(200);

      const usd = res.body.data.find((r: { currencyCode: string }) => r.currencyCode === 'USD');
      expect(usd.rate).toBe('38.4210');
    });
  });

  // ================================================================ Excel disa aktarma

  describe('Excel disa aktarma (§11.3 CSV injection)', () => {
    it('cari listesi Excel olarak iner', async () => {
      const res = await http()
        .get('/v1/exports?target=BUYERS')
        .set(auth(tokens.s1Admin!))
        .buffer()
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      // XLSX bir ZIP'tir → "PK" imzasi.
      expect((res.body as Buffer).subarray(0, 2).toString()).toBe('PK');
    });

    it('FORMUL ile baslayan unvan etkisizlestirilir (=cmd|... calismasin)', async () => {
      const evil = await rawPrisma.buyerAccount.create({
        data: {
          sellerId: ids.seller1Id,
          accountCode: 'EVIL-1',
          title: '=cmd|"/c calc"!A1',
          creditLimit: '0',
        },
      });

      const res = await http()
        .get('/v1/exports?target=BUYERS')
        .set(auth(tokens.s1Admin!))
        .buffer()
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);

      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      // ExcelJS'in tipi ArrayBuffer der ama Buffer kabul eder (bkz. excel.parser.ts).
      await workbook.xlsx.load(res.body as unknown as ArrayBuffer);
      const sheet = workbook.getWorksheet('Cari Hesaplar')!;

      let found = '';
      sheet.eachRow((row) => {
        const title = String(row.getCell(2).value ?? '');
        if (title.includes('cmd')) found = title;
      });

      // Hucre FORMUL olarak baslamamali → basina tirnak konur.
      expect(found).not.toMatch(/^=/);
      expect(found).toContain("'=cmd");

      await rawPrisma.buyerAccount.delete({ where: { id: evil.id } });
    });

    it('ALICI cari LISTESINI indiremez (§11.2 IDOR)', async () => {
      const res = await http().get('/v1/exports?target=BUYERS').set(auth(tokens.buyer1!));
      expect(res.status).toBe(403);
    });
  });
});
