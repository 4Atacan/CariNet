import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mul, sub } from '@carinet/shared';
import {
  SEED_PASSWORD,
  USERS,
  type SeedIds,
  createTestApp,
  loadSeedIds,
  rawPrisma,
} from './setup/test-app';

/** Faz 1 — fatura + kalem + otomatik DEBIT hareketi (kural #1, #2, #4). */
describe('Faturalar (e2e)', () => {
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
    tokens.s2Admin = await login(USERS.seller2Admin);
    tokens.buyer1 = await login(USERS.buyer1);
  });

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  describe('olusturma', () => {
    it('toplamlar SUNUCUDA hesaplanir ve DEBIT hareketi otomatik olusur', async () => {
      const before = await balanceOf(ids.a1Id, tokens.s1Admin!);

      const res = await http()
        .post('/v1/invoices')
        .set(auth(tokens.s1Admin!))
        .send({
          buyerAccountId: ids.a1Id,
          invoiceNo: 'E2E-FTR-001',
          invoiceDate: '2026-07-01',
          dueDate: '2026-07-31',
          items: [
            { name: 'Zeytinyagi 5L', quantity: '10', unitPrice: '450.00', taxRate: '20' },
            { name: 'Un 50kg', quantity: '3.5', unitPrice: '620.00', taxRate: '10' },
          ],
        })
        .expect(201);

      const invoice = res.body.data;
      // 10 x 450 = 4500.00 (+%20 = 900.00) · 3.5 x 620 = 2170.00 (+%10 = 217.00)
      expect(invoice.netTotal).toBe('6670.00');
      expect(invoice.taxTotal).toBe('1117.00');
      expect(invoice.grandTotal).toBe('7787.00');
      expect(invoice.items).toHaveLength(2);
      expect(invoice.items[0].lineTotal).toBe('5400.00');

      const tx = await rawPrisma.transaction.findFirstOrThrow({
        where: { invoiceId: invoice.id },
      });
      expect(tx.type).toBe('DEBIT');
      expect(tx.documentType).toBe('SALES_INVOICE');
      expect(tx.amount.toString()).toBe('7787');

      // Bakiye tam olarak fatura tutari kadar artar (kural #2).
      expect(sub(await balanceOf(ids.a1Id, tokens.s1Admin!), before)).toBe('7787.00');
    });

    it('ayni fatura numarasi iki kez kullanilamaz', async () => {
      const res = await http()
        .post('/v1/invoices')
        .set(auth(tokens.s1Admin!))
        .send({
          buyerAccountId: ids.a1Id,
          invoiceNo: 'E2E-FTR-001',
          invoiceDate: '2026-07-02',
          items: [{ name: 'Kopya', quantity: '1', unitPrice: '1.00', taxRate: '0' }],
        })
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('dovizli fatura bakiyeye TRY karsiligiyla yansir (kur satira sabit)', async () => {
      const before = await balanceOf(ids.a2Id, tokens.s1Admin!);

      const res = await http()
        .post('/v1/invoices')
        .set(auth(tokens.s1Admin!))
        .send({
          buyerAccountId: ids.a2Id,
          invoiceNo: 'E2E-FTR-USD-001',
          invoiceDate: '2026-07-03',
          currencyCode: 'USD',
          exchangeRate: '38.4210',
          items: [{ name: 'Ithal kahve', quantity: '2', unitPrice: '100.00', taxRate: '0' }],
        })
        .expect(201);

      expect(res.body.data.grandTotal).toBe('200.00'); // USD cinsinden
      const expectedTry = mul('200.00', '38.4210'); // 7684.20
      expect(sub(await balanceOf(ids.a2Id, tokens.s1Admin!), before)).toBe(expectedTry);
    });

    it('kalemsiz fatura reddedilir', async () => {
      await http()
        .post('/v1/invoices')
        .set(auth(tokens.s1Admin!))
        .send({
          buyerAccountId: ids.a1Id,
          invoiceNo: 'E2E-FTR-BOS',
          invoiceDate: '2026-07-01',
          items: [],
        })
        .expect(400);
    });
  });

  describe('iptal (kural #4)', () => {
    it('fatura iptali bagli DEBIT hareketini de iptal eder ve bakiye geri doner', async () => {
      const invoice = await rawPrisma.invoice.findFirstOrThrow({
        where: { sellerId: ids.seller1Id, invoiceNo: 'E2E-FTR-001' },
      });
      const before = await balanceOf(ids.a1Id, tokens.s1Admin!);

      await http()
        .post(`/v1/invoices/${invoice.id}/cancel`)
        .set(auth(tokens.s1Admin!))
        .send({ reason: 'E2E iptal' })
        .expect(201);

      expect(sub(await balanceOf(ids.a1Id, tokens.s1Admin!), before)).toBe('-7787.00');

      const [stored, tx] = await Promise.all([
        rawPrisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } }),
        rawPrisma.transaction.findFirstOrThrow({ where: { invoiceId: invoice.id } }),
      ]);
      expect(stored.isCancelled).toBe(true); // kayit SILINMEDI
      expect(tx.isCancelled).toBe(true);

      const audit = await rawPrisma.auditLog.findFirst({
        where: { entity: 'Invoice', entityId: invoice.id, action: 'CANCEL' },
      });
      expect(audit).not.toBeNull(); // finansal degisim → audit zorunlu
    });

    it('iptal edilmis fatura tekrar iptal edilemez', async () => {
      const invoice = await rawPrisma.invoice.findFirstOrThrow({
        where: { sellerId: ids.seller1Id, invoiceNo: 'E2E-FTR-001' },
      });
      await http()
        .post(`/v1/invoices/${invoice.id}/cancel`)
        .set(auth(tokens.s1Admin!))
        .send({ reason: 'tekrar' })
        .expect(409);
    });
  });

  describe('okuma', () => {
    it('alici kendi faturasini kalemleriyle gorur', async () => {
      const invoice = await rawPrisma.invoice.findFirstOrThrow({
        where: { buyerAccountId: ids.a1Id, isCancelled: false },
      });
      const res = await http()
        .get(`/v1/invoices/${invoice.id}`)
        .set(auth(tokens.buyer1!))
        .expect(200);

      expect(res.body.data.items.length).toBeGreaterThan(0);
      expect(res.body.data.items[0].exchangeRate).toMatch(/^\d+\.\d{4}$/); // satir bazli kur
    });

    it('alici baska carinin faturasini goremez', async () => {
      const invoice = await rawPrisma.invoice.findFirstOrThrow({
        where: { buyerAccountId: ids.a2Id },
      });
      const res = await http()
        .get(`/v1/invoices/${invoice.id}`)
        .set(auth(tokens.buyer1!))
        .expect(403);
      expect(res.body.error.code).toBe('TENANT_FORBIDDEN');
    });
  });

  describe('tenant izolasyonu (kural #3)', () => {
    it('satici-2 admini satici-1 carisine fatura KESEMEZ', async () => {
      await http()
        .post('/v1/invoices')
        .set(auth(tokens.s2Admin!))
        .send({
          buyerAccountId: ids.a1Id,
          invoiceNo: 'SABOTAJ-001',
          invoiceDate: '2026-07-01',
          items: [{ name: 'x', quantity: '1', unitPrice: '1.00', taxRate: '0' }],
        })
        .expect(404);

      const leaked = await rawPrisma.invoice.findFirst({ where: { invoiceNo: 'SABOTAJ-001' } });
      expect(leaked).toBeNull(); // hicbir tenant'a yazilmadi
    });

    it('satici-2 admini satici-1 faturasini goremez ve iptal edemez', async () => {
      const invoice = await rawPrisma.invoice.findFirstOrThrow({
        where: { sellerId: ids.seller1Id, isCancelled: false },
      });

      await http().get(`/v1/invoices/${invoice.id}`).set(auth(tokens.s2Admin!)).expect(404);
      await http()
        .post(`/v1/invoices/${invoice.id}/cancel`)
        .set(auth(tokens.s2Admin!))
        .send({ reason: 'sabotaj' })
        .expect(404);

      const untouched = await rawPrisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(untouched.isCancelled).toBe(false);
    });

    it('satici-2 fatura listesinde satici-1 faturalari YOKTUR', async () => {
      const res = await http().get('/v1/invoices?limit=100').set(auth(tokens.s2Admin!)).expect(200);

      const buyerIds = new Set(
        res.body.data.map((i: { buyerAccountId: string }) => i.buyerAccountId),
      );
      expect(buyerIds.has(ids.a1Id)).toBe(false);
    });
  });
});
