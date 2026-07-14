import { type INestApplication } from '@nestjs/common';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sub, sum } from '@carinet/shared';
import {
  SEED_PASSWORD,
  USERS,
  type SeedIds,
  createTestApp,
  loadSeedIds,
  rawPrisma,
} from './setup/test-app';

/** Faz 1 — import hatti (§6.6) + Gecis Sihirbazi (§9). */
describe('Import hatti (e2e)', () => {
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
  });

  afterAll(async () => {
    // Seed kurgusu degismez kalmali (§4): sihirbazin urettigi cariler + hareketleri temizlenir.
    // Yalniz TEST verisi; uygulama kodu finansal kayit silmez (kural #4).
    const created = await rawPrisma.buyerAccount.findMany({
      where: { accountCode: { startsWith: 'DEVIR-' } },
      select: { id: true },
    });
    const accountIds = created.map((a) => a.id);
    await rawPrisma.transaction.deleteMany({ where: { buyerAccountId: { in: accountIds } } });
    await rawPrisma.buyerAccount.deleteMany({ where: { id: { in: accountIds } } });
    await app.close();
    await rawPrisma.$disconnect();
  });

  // ---------------------------------------------------------------- Excel → hareket

  describe('Excel hareket importu', () => {
    let batchId: string;
    let netTotal: string;

    it('200 satirlik Excel hatasiz ayristirilir (Faz 1 bitti kriteri)', async () => {
      const amounts = Array.from({ length: 200 }, (_, i) => (1000 + i).toFixed(2));
      netTotal = sum(amounts);

      const buffer = await buildWorkbook(
        ['Cari Kodu', 'Belge Tarihi', 'Vade', 'Belge No', 'Borç', 'Alacak', 'Açıklama'],
        amounts.map((amount, i) => [
          '120.01.002',
          '15.01.2026',
          '15.02.2026',
          `EXL-${i + 1}`,
          amount, // borc kolonu → DEBIT
          '',
          'Excel import satiri',
        ]),
      );

      const res = await http()
        .post('/v1/imports')
        .set(auth(tokens.s1Admin!))
        .field('target', 'TRANSACTIONS')
        .attach('file', buffer, 'hareketler.xlsx')
        .expect(201);

      batchId = res.body.data.batchId;
      expect(res.body.data.totals.rowCount).toBe(200);
      expect(res.body.data.totals.validCount).toBe(200);
      expect(res.body.data.totals.errorCount).toBe(0);
      expect(res.body.data.totals.totalDebit).toBe(netTotal);
      // Otomatik kolon eslemesi Turkce basliklari tanidi
      expect(res.body.data.mapping.accountCode).toBe('Cari Kodu');
      expect(res.body.data.mapping.debit).toBe('Borç');
    });

    it('staging asamasi HICBIR finansal kayit yazmaz (§6.6)', async () => {
      const written = await rawPrisma.transaction.count({ where: { importBatchId: batchId } });
      expect(written).toBe(0);
    });

    it('commit tek transactionda yazar ve bakiye tam olarak net kadar artar', async () => {
      const before = await balanceOf(ids.a2Id, tokens.s1Admin!);

      const res = await http()
        .post(`/v1/imports/${batchId}/commit`)
        .set(auth(tokens.s1Admin!))
        .send({})
        .expect(201);

      expect(res.body.data.totals.createdTransactions).toBe(200);
      expect(sub(await balanceOf(ids.a2Id, tokens.s1Admin!), before)).toBe(netTotal);
    });

    it('ayni batch iki kez commit edilemez', async () => {
      await http()
        .post(`/v1/imports/${batchId}/commit`)
        .set(auth(tokens.s1Admin!))
        .send({})
        .expect(409);
    });

    it('batch iptali bagli 200 hareketi TOPLU iptal eder, bakiye geri doner', async () => {
      const before = await balanceOf(ids.a2Id, tokens.s1Admin!);

      const res = await http()
        .post(`/v1/imports/${batchId}/cancel`)
        .set(auth(tokens.s1Admin!))
        .send({ reason: 'E2E toplu iptal' })
        .expect(201);

      expect(res.body.data.cancelledTransactions).toBe(200);
      expect(sub(await balanceOf(ids.a2Id, tokens.s1Admin!), before)).toBe(`-${netTotal}`);

      // Kural #4: kayitlar SILINMEDI
      const stillThere = await rawPrisma.transaction.count({ where: { importBatchId: batchId } });
      expect(stillThere).toBe(200);
    });
  });

  describe('hata raporu (§6.6)', () => {
    it('hatali satirlar satir no + sebep ile raporlanir, commit engellenir', async () => {
      const buffer = await buildWorkbook(
        ['Cari Kodu', 'Belge Tarihi', 'Borç', 'Alacak'],
        [
          ['120.01.001', '01.02.2026', '1000.00', ''],
          ['120.01.001', 'gecersiz-tarih', '500.00', ''], // tarih hatasi
          ['120.01.001', '03.02.2026', '', ''], // tutarsiz satir
          ['120.01.001', '04.02.2026', '', '250.00'], // alacak → CREDIT
        ],
      );

      const upload = await http()
        .post('/v1/imports')
        .set(auth(tokens.s1Admin!))
        .field('target', 'TRANSACTIONS')
        .attach('file', buffer, 'hatali.xlsx')
        .expect(201);

      const { batchId, totals, errors } = upload.body.data;
      expect(totals.validCount).toBe(2);
      expect(totals.errorCount).toBe(2);
      expect(errors[0].rowNo).toBe(3); // basliktan sonraki 2. veri satiri
      expect(errors[0].error).toBeTruthy();

      // Hatali satir varken commit REDDEDILIR
      const rejected = await http()
        .post(`/v1/imports/${batchId}/commit`)
        .set(auth(tokens.s1Admin!))
        .send({})
        .expect(422);
      expect(rejected.body.error.code).toBe('IMPORT_ROW_ERRORS');

      // Kullanici "hatali satirlari atla" derse yalniz gecerliler yazilir
      const committed = await http()
        .post(`/v1/imports/${batchId}/commit`)
        .set(auth(tokens.s1Admin!))
        .send({ skipErrorRows: true })
        .expect(201);
      expect(committed.body.data.totals.createdTransactions).toBe(2);

      await http()
        .post(`/v1/imports/${batchId}/cancel`)
        .set(auth(tokens.s1Admin!))
        .send({ reason: 'temizlik' })
        .expect(201);
    });

    it('bilinmeyen basliklarda zorunlu kolon eslenemezse oneri doner', async () => {
      const buffer = await buildWorkbook(
        ['Kolon A', 'Kolon B'],
        [
          ['x', 'y'],
          ['z', 'w'],
        ],
      );

      const res = await http()
        .post('/v1/imports')
        .set(auth(tokens.s1Admin!))
        .field('target', 'TRANSACTIONS')
        .attach('file', buffer, 'bilinmeyen.xlsx')
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.missing).toContain('accountCode');
    });
  });

  // ---------------------------------------------------------------- Gecis Sihirbazi (§9)

  describe('Gecis Sihirbazi — devir (§9)', () => {
    let batchId: string;

    it('devir dosyasi cari yoksa cariyi de olusturur (kesim tarihi zorunlu)', async () => {
      const buffer = await buildWorkbook(
        ['Cari Kodu', 'Unvan', 'VKN', 'Bakiye'],
        [
          ['DEVIR-001', 'Devir Musteri A', '1112223334', '15.000,00'],
          ['DEVIR-002', 'Devir Musteri B', '', '-2.500,00'], // alacakli devir
        ],
      );

      const missingCutoff = await http()
        .post('/v1/imports')
        .set(auth(tokens.s1Admin!))
        .field('target', 'OPENING_BALANCES')
        .attach('file', buffer, 'devir.xlsx')
        .expect(400);
      expect(missingCutoff.body.error.message).toContain('kesim tarihi');

      const res = await http()
        .post('/v1/imports')
        .set(auth(tokens.s1Admin!))
        .field('target', 'OPENING_BALANCES')
        .field('sourceType', 'WIZARD')
        .field('cutoffDate', '2026-01-01')
        .attach('file', buffer, 'devir.xlsx')
        .expect(201);

      batchId = res.body.data.batchId;
      expect(res.body.data.totals.validCount).toBe(2);
      expect(res.body.data.totals.net).toBe('12500.00'); // 15000 borc − 2500 alacak
    });

    it('Dogrulama Raporu: program toplami ile fark varsa commit REDDEDILIR', async () => {
      const report = await http()
        .get(`/v1/imports/${batchId}/validation-report?expectedTotal=13000.00`)
        .set(auth(tokens.s1Admin!))
        .expect(200);

      expect(report.body.data.importedTotal).toBe('12500.00');
      expect(report.body.data.difference).toBe('500.00');
      expect(report.body.data.matches).toBe(false);
      expect(report.body.data.newAccounts).toBe(2);

      const rejected = await http()
        .post(`/v1/imports/${batchId}/commit`)
        .set(auth(tokens.s1Admin!))
        .send({ expectedTotal: '13000.00' })
        .expect(400);
      expect(rejected.body.error.details.difference).toBe('500.00');
    });

    it('fark kapaninca commit gecer; devir tek OPENING_BALANCE hareketi olur (kural #2 bozulmaz)', async () => {
      const res = await http()
        .post(`/v1/imports/${batchId}/commit`)
        .set(auth(tokens.s1Admin!))
        .send({ expectedTotal: '12500.00' })
        .expect(201);

      expect(res.body.data.totals.createdAccounts).toBe(2);
      expect(res.body.data.totals.createdTransactions).toBe(2);

      const account = await rawPrisma.buyerAccount.findFirstOrThrow({
        where: { sellerId: ids.seller1Id, accountCode: 'DEVIR-001' },
      });
      const rows = await rawPrisma.transaction.findMany({ where: { buyerAccountId: account.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.documentType).toBe('OPENING_BALANCE');
      expect(rows[0]!.documentDate.toISOString().slice(0, 10)).toBe('2026-01-01');

      expect(await balanceOf(account.id, tokens.s1Admin!)).toBe('15000.00');
    });

    it('ayni cariye ikinci kez devir girilemez', async () => {
      const buffer = await buildWorkbook(['Cari Kodu', 'Bakiye'], [['DEVIR-001', '9.999,00']]);

      const upload = await http()
        .post('/v1/imports')
        .set(auth(tokens.s1Admin!))
        .field('target', 'OPENING_BALANCES')
        .field('cutoffDate', '2026-01-01')
        .attach('file', buffer, 'devir2.xlsx')
        .expect(201);

      const res = await http()
        .post(`/v1/imports/${upload.body.data.batchId}/commit`)
        .set(auth(tokens.s1Admin!))
        .send({})
        .expect(409);
      expect(res.body.error.message).toContain('devir kaydi zaten var');
    });
  });

  // ---------------------------------------------------------------- UBL (§9 altin kaynak)

  describe('UBL-TR e-Fatura importu', () => {
    it('VKN ile cari eslesir, fatura + kalem + DEBIT hareketi olusur', async () => {
      const before = await balanceOf(ids.a1Id, tokens.s1Admin!);
      const xml = ublInvoice({ invoiceNo: 'UBL-E2E-001', vkn: '1234567890', payable: '1180.00' });

      const upload = await http()
        .post('/v1/imports')
        .set(auth(tokens.s1Admin!))
        .field('target', 'INVOICES')
        .attach('file', Buffer.from(xml, 'utf8'), 'fatura.xml')
        .expect(201);

      expect(upload.body.data.totals.validCount).toBe(1);

      const res = await http()
        .post(`/v1/imports/${upload.body.data.batchId}/commit`)
        .set(auth(tokens.s1Admin!))
        .send({})
        .expect(201);
      expect(res.body.data.totals.createdInvoices).toBe(1);

      const invoice = await rawPrisma.invoice.findFirstOrThrow({
        where: { invoiceNo: 'UBL-E2E-001' },
        include: { items: true },
      });
      expect(invoice.buyerAccountId).toBe(ids.a1Id); // VKN eslesmesi
      expect(invoice.ublUuid).toBeTruthy();
      expect(invoice.items).toHaveLength(1);
      expect(invoice.grandTotal.toString()).toBe('1180');

      expect(sub(await balanceOf(ids.a1Id, tokens.s1Admin!), before)).toBe('1180.00');
    });

    it('eslesmeyen VKN commit edilemez (veri sessizce yanlis cariye yazilmaz)', async () => {
      const xml = ublInvoice({ invoiceNo: 'UBL-E2E-002', vkn: '9999999999', payable: '100.00' });

      const upload = await http()
        .post('/v1/imports')
        .set(auth(tokens.s1Admin!))
        .field('target', 'INVOICES')
        .attach('file', Buffer.from(xml, 'utf8'), 'fatura2.xml')
        .expect(201);

      const res = await http()
        .post(`/v1/imports/${upload.body.data.batchId}/commit`)
        .set(auth(tokens.s1Admin!))
        .send({})
        .expect(400);
      expect(res.body.error.message).toContain('eslesen cari yok');

      const leaked = await rawPrisma.invoice.findFirst({ where: { invoiceNo: 'UBL-E2E-002' } });
      expect(leaked).toBeNull();
    });
  });

  // ---------------------------------------------------------------- tenant

  describe('tenant izolasyonu (kural #3)', () => {
    it('satici-2 admini satici-1 yuklemesini goremez / commit edemez / iptal edemez', async () => {
      const batch = await rawPrisma.importBatch.findFirstOrThrow({
        where: { sellerId: ids.seller1Id },
      });

      await http().get(`/v1/imports/${batch.id}/rows`).set(auth(tokens.s2Admin!)).expect(404);
      await http()
        .post(`/v1/imports/${batch.id}/commit`)
        .set(auth(tokens.s2Admin!))
        .send({})
        .expect(404);
      await http()
        .post(`/v1/imports/${batch.id}/cancel`)
        .set(auth(tokens.s2Admin!))
        .send({ reason: 'sabotaj' })
        .expect(404);
    });

    it('satici-2 yukleme listesinde satici-1 batchleri YOKTUR', async () => {
      const res = await http().get('/v1/imports?limit=100').set(auth(tokens.s2Admin!)).expect(200);
      expect(res.body.data).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------- fikstur ureticileri

async function buildWorkbook(headers: string[], rows: string[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sayfa1');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function ublInvoice(p: { invoiceNo: string; vkn: string; payable: string }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UUID>a1b2c3d4-${p.invoiceNo}</cbc:UUID>
  <cbc:ID>${p.invoiceNo}</cbc:ID>
  <cbc:IssueDate>2026-02-10</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
  <cac:PaymentTerms><cbc:PaymentDueDate>2026-03-12</cbc:PaymentDueDate></cac:PaymentTerms>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="VKN">${p.vkn}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>Alici Firma</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="TRY">180.00</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="TRY">1000.00</cbc:LineExtensionAmount>
    <cbc:PayableAmount currencyID="TRY">${p.payable}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">10</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="TRY">1000.00</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="TRY">180.00</cbc:TaxAmount>
      <cac:TaxSubtotal><cbc:Percent>18</cbc:Percent></cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item><cbc:Name>Test Urunu</cbc:Name></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="TRY">100.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`;
}
