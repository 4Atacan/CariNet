import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  SEED_PASSWORD,
  USERS,
  type SeedIds,
  createTestApp,
  loadSeedIds,
  rawPrisma,
} from './setup/test-app';

/**
 * Faz 2 bitti kriteri: "rapor rakamlari seed ile ELLE hesaplananlara esit".
 * Bu yuzden kontrollu bir cari kurulur ve beklenen degerler testte ELLE yazilir —
 * uygulamanin kendi hesap fonksiyonu ile karsilastirilmaz (dairesel dogrulama olmaz).
 */
describe('Raporlar (e2e)', () => {
  let app: INestApplication;
  let ids: SeedIds;
  let riskAccountId: string;
  const tokens: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const login = async (email: string): Promise<string> => {
    const res = await http().post('/v1/auth/login').send({ email, password: SEED_PASSWORD });
    return res.body.data.tokens.accessToken;
  };

  /** Bugune gore gun ofseti — testin tarihe bagli kalmamasi icin. */
  const day = (offset: number): Date => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + offset);
    return d;
  };

  beforeAll(async () => {
    app = await createTestApp();
    ids = await loadSeedIds();
    tokens.s1Admin = await login(USERS.seller1Admin);
    tokens.s2Admin = await login(USERS.seller2Admin);
    tokens.buyer1 = await login(USERS.buyer1);

    // Kontrollu senaryo (tutarlar ve vadeler elle secildi):
    //   F1: 10.000 borc, vadesi 100 gun once  → D90_PLUS
    //   F2:  5.000 borc, vadesi  45 gun once  → D31_60
    //   F3:  8.000 borc, vadesi  20 gun SONRA → NOT_DUE
    //   T1:  4.000 alacak → FIFO: en eski borctan (F1) duser
    // Beklenen: bakiye 19.000 · acik: F1 6.000 (D90_PLUS) + F2 5.000 (D31_60) + F3 8.000 (NOT_DUE)
    //           vadesi gecen = 11.000 · limit 20.000 → %95
    const account = await rawPrisma.buyerAccount.create({
      data: {
        sellerId: ids.seller1Id,
        accountCode: 'RAPOR-001',
        title: 'Rapor Test Cari',
        creditLimit: '20000.00',
      },
    });
    riskAccountId = account.id;

    await rawPrisma.transaction.createMany({
      data: [
        {
          sellerId: ids.seller1Id,
          buyerAccountId: account.id,
          type: 'DEBIT',
          documentType: 'SALES_INVOICE',
          documentNo: 'F1',
          documentDate: day(-130),
          dueDate: day(-100),
          amount: '10000.00',
        },
        {
          sellerId: ids.seller1Id,
          buyerAccountId: account.id,
          type: 'DEBIT',
          documentType: 'SALES_INVOICE',
          documentNo: 'F2',
          documentDate: day(-75),
          dueDate: day(-45),
          amount: '5000.00',
        },
        {
          sellerId: ids.seller1Id,
          buyerAccountId: account.id,
          type: 'DEBIT',
          documentType: 'SALES_INVOICE',
          documentNo: 'F3',
          documentDate: day(-10),
          dueDate: day(20),
          amount: '8000.00',
        },
        {
          sellerId: ids.seller1Id,
          buyerAccountId: account.id,
          type: 'CREDIT',
          documentType: 'PAYMENT',
          documentNo: 'T1',
          documentDate: day(-5),
          amount: '4000.00',
        },
      ],
    });
  });

  afterAll(async () => {
    await rawPrisma.transaction.deleteMany({ where: { buyerAccountId: riskAccountId } });
    await rawPrisma.buyerAccount.delete({ where: { id: riskAccountId } });
    await app.close();
    await rawPrisma.$disconnect();
  });

  describe('Risk Foyu', () => {
    it('yaslandirma kovalari elle hesaplanan degerlerle birebir ayni', async () => {
      const res = await http()
        .get(`/v1/reports/risk/${riskAccountId}`)
        .set(auth(tokens.s1Admin!))
        .expect(200);

      const data = res.body.data;
      expect(data.balance).toBe('19000.00'); // 23.000 borc − 4.000 alacak
      expect(data.overdue).toBe('11000.00'); // 6.000 + 5.000
      expect(data.notDue).toBe('8000.00');
      expect(data.buckets.D90_PLUS).toBe('6000.00'); // 10.000 − 4.000 (FIFO)
      expect(data.buckets.D31_60).toBe('5000.00');
      expect(data.buckets.NOT_DUE).toBe('8000.00');
      expect(data.buckets.D0_30).toBe('0.00');
      expect(data.buckets.D61_90).toBe('0.00');
    });

    it('kovalarin toplami bakiyeye esittir (kurus kacagi yok)', async () => {
      const res = await http()
        .get(`/v1/reports/risk/${riskAccountId}`)
        .set(auth(tokens.s1Admin!))
        .expect(200);

      const buckets: Record<string, string> = res.body.data.buckets;
      const total = Object.values(buckets).reduce((acc, v) => acc + Number(v), 0);
      expect(total.toFixed(2)).toBe(res.body.data.balance);
    });

    it('limit kullanimi yuzdesi dogru (19.000 / 20.000 = %95)', async () => {
      const res = await http()
        .get(`/v1/reports/risk/${riskAccountId}`)
        .set(auth(tokens.s1Admin!))
        .expect(200);
      expect(res.body.data.limitUsagePercent).toBe(95);
    });

    it('acik kalemler FIFO ile dogru: en eski fatura kismen kapanmis', async () => {
      const res = await http()
        .get(`/v1/reports/risk/${riskAccountId}`)
        .set(auth(tokens.s1Admin!))
        .expect(200);

      const items = res.body.data.openItems;
      expect(items).toHaveLength(3);
      expect(items[0].remaining).toBe('6000.00'); // F1: 10.000 − 4.000 tahsilat
      expect(items[0].bucket).toBe('D90_PLUS');
      expect(items[1].remaining).toBe('5000.00'); // F2 dokunulmamis
    });

    it('risk foyu listesi saticinin TUM carilerini kapsar', async () => {
      const res = await http().get('/v1/reports/risk').set(auth(tokens.s1Admin!)).expect(200);
      const codes = res.body.data.map((r: { accountCode: string }) => r.accountCode);
      expect(codes).toContain('RAPOR-001');
      expect(codes).toContain('120.01.001');
    });
  });

  describe('Ortalama Vade (tutar agirlikli)', () => {
    it('acik kalemlerin agirlikli ortalamasini verir', async () => {
      const res = await http()
        .get(`/v1/reports/average-due/${riskAccountId}`)
        .set(auth(tokens.s1Admin!))
        .expect(200);

      // Agirlikli ortalama gun = (6000×(−100) + 5000×(−45) + 8000×(+20)) / 19000
      //                        = (−600000 − 225000 + 160000) / 19000 = −35 gun (bugune gore)
      // → ortalama vade 35 gun ONCE, yani 35 gun gecikmis.
      expect(res.body.data.averageOverdueDays).toBe(35);
      expect(res.body.data.openBalance).toBe('19000.00');
      expect(res.body.data.overdue).toBe('11000.00');
    });
  });

  describe('Donemsel Bakiye', () => {
    it('aylik borc/alacak ve kumulatif bakiye doner', async () => {
      const res = await http()
        .get(`/v1/reports/periodic-balance?buyerAccountId=${riskAccountId}`)
        .set(auth(tokens.s1Admin!))
        .expect(200);

      const points = res.body.data.points;
      expect(points.length).toBeGreaterThan(0);

      // Son donemin kumulatif bakiyesi guncel bakiyeye esit olmali (kural #2 tutarliligi)
      expect(points[points.length - 1].balance).toBe('19000.00');

      // Donem borc/alacak toplamlari hareketlerle ortusuyor
      const totalDebit = points.reduce(
        (acc: number, p: { debit: string }) => acc + Number(p.debit),
        0,
      );
      const totalCredit = points.reduce(
        (acc: number, p: { credit: string }) => acc + Number(p.credit),
        0,
      );
      expect(totalDebit.toFixed(2)).toBe('23000.00');
      expect(totalCredit.toFixed(2)).toBe('4000.00');
    });

    it('tarih filtresinde acilis bakiyesi ayrica raporlanir (devir kaybolmaz)', async () => {
      const from = new Date();
      from.setUTCDate(from.getUTCDate() - 30);
      const res = await http()
        .get(
          `/v1/reports/periodic-balance?buyerAccountId=${riskAccountId}&from=${from
            .toISOString()
            .slice(0, 10)}`,
        )
        .set(auth(tokens.s1Admin!))
        .expect(200);

      // Son 30 gunde yalniz F3 (8.000 borc) ve T1 (4.000 alacak) var → acilis 15.000
      expect(res.body.data.openingBalance).toBe('15000.00');
      const last = res.body.data.points[res.body.data.points.length - 1];
      expect(last.balance).toBe('19000.00'); // acilis + donem hareketleri
    });
  });

  describe('Ekstre PDF', () => {
    it('gecerli bir PDF dosyasi doner (zarf DISINDA, ham ikili)', async () => {
      const res = await http()
        .get(`/v1/reports/statement-pdf/${riskAccountId}`)
        .set(auth(tokens.s1Admin!))
        .buffer()
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('ekstre-RAPOR-001.pdf');
      expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-'); // gercek PDF imzasi
      expect((res.body as Buffer).length).toBeGreaterThan(1000);
    });
  });

  describe('tenant izolasyonu (kural #3)', () => {
    it('satici-2 admini satici-1 carisinin risk foyunu goremez', async () => {
      await http().get(`/v1/reports/risk/${riskAccountId}`).set(auth(tokens.s2Admin!)).expect(404);
    });

    it('satici-2 risk listesinde satici-1 carileri YOKTUR', async () => {
      const res = await http().get('/v1/reports/risk').set(auth(tokens.s2Admin!)).expect(200);
      const codes = res.body.data.map((r: { accountCode: string }) => r.accountCode);
      expect(codes).not.toContain('RAPOR-001');
      expect(codes).toEqual(['CARI-001']);
    });

    it('alici baska carinin risk foyunu / PDF ekstresini alamaz', async () => {
      await http().get(`/v1/reports/risk/${riskAccountId}`).set(auth(tokens.buyer1!)).expect(403);

      await http()
        .get(`/v1/reports/statement-pdf/${riskAccountId}`)
        .set(auth(tokens.buyer1!))
        .expect(403);
    });

    it('alici KENDI risk foyunu ve PDF ekstresini alabilir', async () => {
      const risk = await http()
        .get(`/v1/reports/risk/${ids.a1Id}`)
        .set(auth(tokens.buyer1!))
        .expect(200);
      expect(risk.body.data.buyerAccountId).toBe(ids.a1Id);

      await http()
        .get(`/v1/reports/statement-pdf/${ids.a1Id}`)
        .set(auth(tokens.buyer1!))
        .expect(200);
    });
  });
});
