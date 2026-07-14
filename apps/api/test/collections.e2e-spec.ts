import { createHmac } from 'node:crypto';
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
 * §13 Faz 3 bitti kriteri — UCU de burada kanitlanir:
 *   (1) sahte ekstreyle havale akisi UCTAN UCA,
 *   (2) sandbox POS: hosted 3D paketi → imzali callback → BAKIYE DUSER,
 *   (3) ayni intent / ayni satir / ayni callback IKINCI KEZ islenemiyor.
 *
 * Bakiye her adimda /buyers/:id (canli bakiye, kural #2) ile dogrulanir — beklenen degerler
 * testte ELLE yazilidir.
 */
describe('Tahsilat — iki kanal (e2e)', () => {
  let app: INestApplication;
  let ids: SeedIds;
  let accountId: string; // satici-1'de kontrollu cari (havale senaryosu)
  let cardAccountId: string; // satici-2'de kontrollu cari (POS senaryosu — sandbox POS orada)
  const tokens: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const login = async (email: string): Promise<string> => {
    const res = await http().post('/v1/auth/login').send({ email, password: SEED_PASSWORD });
    return res.body.data.tokens.accessToken;
  };

  const balanceOf = async (id: string, token: string): Promise<string> => {
    const res = await http().get(`/v1/buyers/${id}`).set(auth(token));
    return res.body.data.balance.balance as string;
  };

  const csv = (lines: string[]): Buffer => Buffer.from(lines.join('\n'), 'utf8');

  beforeAll(async () => {
    app = await createTestApp();
    ids = await loadSeedIds();
    tokens.s1Admin = await login(USERS.seller1Admin);
    tokens.s2Admin = await login(USERS.seller2Admin);
    tokens.buyer1 = await login(USERS.buyer1);

    // Havale senaryosu: 20.000 borclu temiz bir cari (satici-1).
    const account = await rawPrisma.buyerAccount.create({
      data: {
        sellerId: ids.seller1Id,
        accountCode: 'TAHS-001',
        title: 'Tahsilat Test Cari',
        creditLimit: '50000.00',
      },
    });
    accountId = account.id;
    await rawPrisma.transaction.create({
      data: {
        sellerId: ids.seller1Id,
        buyerAccountId: account.id,
        type: 'DEBIT',
        documentType: 'SALES_INVOICE',
        documentNo: 'TF-1',
        documentDate: new Date('2026-06-01'),
        dueDate: new Date('2026-07-01'),
        amount: '20000.00',
      },
    });

    // Kart senaryosu: sandbox POS satici-2'de tanimli (seed) → cari de orada olmali.
    const cardAccount = await rawPrisma.buyerAccount.create({
      data: {
        sellerId: ids.seller2Id,
        accountCode: 'TAHS-POS',
        title: 'Kart Test Cari',
        creditLimit: '50000.00',
      },
    });
    cardAccountId = cardAccount.id;
    await rawPrisma.transaction.create({
      data: {
        sellerId: ids.seller2Id,
        buyerAccountId: cardAccount.id,
        type: 'DEBIT',
        documentType: 'SALES_INVOICE',
        documentNo: 'PF-1',
        documentDate: new Date('2026-06-01'),
        dueDate: new Date('2026-07-01'),
        amount: '10000.00',
      },
    });
  });

  afterAll(async () => {
    // FK sirasi: hareket → ekstre satiri → intent → cari.
    const accounts = [accountId, cardAccountId];
    await rawPrisma.transaction.deleteMany({ where: { buyerAccountId: { in: accounts } } });
    await rawPrisma.bankStatementRow.deleteMany({
      where: { matchedIntent: { buyerAccountId: { in: accounts } } },
    });
    await rawPrisma.collectIntent.deleteMany({ where: { buyerAccountId: { in: accounts } } });
    await rawPrisma.notification.deleteMany({ where: { buyerAccountId: { in: accounts } } });
    await rawPrisma.buyerAccount.deleteMany({ where: { id: { in: accounts } } });
    await app.close();
    await rawPrisma.$disconnect();
  });

  // ================================================================ KANAL 1: havale

  describe('Kanal 1 — havale/EFT + referans eslestirme', () => {
    it('alici odeme talebi acar: referans kodu + saticinin IBAN"i doner', async () => {
      const res = await http()
        .post('/v1/collections/intents')
        .set(auth(tokens.buyer1!))
        .send({ amount: '1000.00', channel: 'BANK_TRANSFER' });

      expect(res.status).toBe(201);
      expect(res.body.data.intent.status).toBe('PENDING');
      // §7 bicimi: S{sellerNo}-{accountCode}-{6}
      expect(res.body.data.intent.referenceCode).toMatch(/^S\d+-.+-[A-Z0-9]{6}$/);
      expect(res.body.data.bankAccounts[0].iban).toMatch(/^TR\d{24}$/);
      // Kart formu YOK, para akisi bizde degil (kural #5).
      expect(res.body.data.payment).toBeNull();
    });

    it('alici baskasinin carisi adina talep acamaz (IDOR)', async () => {
      const res = await http()
        .post('/v1/collections/intents')
        .set(auth(tokens.buyer1!))
        .send({ amount: '500.00', buyerAccountId: accountId });

      // buyerAccountId yok sayilir → kendi carisine acilir.
      expect(res.status).toBe(201);
      expect(res.body.data.intent.buyerAccountId).toBe(ids.a1Id);
    });

    it('UCTAN UCA: ekstre yukle → otomatik eslestir → toplu onay → bakiye duser', async () => {
      const before = await balanceOf(accountId, tokens.s1Admin!);
      expect(before).toBe('20000.00');

      // 1) Panel cari adina talep acar (musteri "5.000 odeyecegim" dedi).
      const intentRes = await http()
        .post('/v1/collections/intents')
        .set(auth(tokens.s1Admin!))
        .send({ amount: '5000.00', buyerAccountId: accountId });
      const reference = intentRes.body.data.intent.referenceCode as string;

      // 2) Banka ekstresi: musteri referans kodunu aciklamaya yazmis.
      const statement = csv([
        'Tarih;Aciklama;Tutar',
        `2026-07-10;EFT GELEN ${reference} TAHSILAT TEST;5.000,00`,
        '2026-07-10;FAST GELEN ACIKLAMASIZ;750,00',
        '2026-07-11;GIDEN HAVALE TEDARIKCI;-2.000,00',
      ]);

      const upload = await http()
        .post('/v1/collections/statement-import')
        .set(auth(tokens.s1Admin!))
        .attach('file', statement, 'ekstre.csv');

      expect(upload.status).toBe(201);
      const batchId = upload.body.data.batchId as string;
      // Cikis hareketi tahsilat degildir → satirlara alinmaz.
      expect(upload.body.data.skippedOutgoing).toBe(1);
      expect(upload.body.data.rows).toHaveLength(2);

      const matches = upload.body.data.matches as {
        rowId: string;
        confidence: string;
        intentId: string | null;
      }[];
      const exact = matches.find((m) => m.confidence === 'EXACT');
      const none = matches.find((m) => m.confidence === 'NONE');
      expect(exact?.intentId).toBe(intentRes.body.data.intent.id);
      expect(none).toBeDefined(); // aciklamasiz dekont insana birakilir

      // 3) Toplu onay: eslesen satir + aciklamasiz satir (insan cariyi secti).
      const confirm = await http()
        .post(`/v1/collections/statement-import/${batchId}/confirm`)
        .set(auth(tokens.s1Admin!))
        .send({
          matches: [
            { rowId: exact!.rowId, intentId: exact!.intentId },
            { rowId: none!.rowId, buyerAccountId: accountId },
          ],
        });

      expect(confirm.status).toBe(201);
      expect(confirm.body.data.confirmed).toBe(2);

      // 4) Bakiye: 20.000 − 5.000 − 750 = 14.250 (kural #2: turetilir, saklanmaz).
      expect(await balanceOf(accountId, tokens.s1Admin!)).toBe('14250.00');
    });

    it('IDEMPOTENT: ayni ekstre satiri ikinci kez onaylanamaz (bakiye degismez)', async () => {
      const intentRes = await http()
        .post('/v1/collections/intents')
        .set(auth(tokens.s1Admin!))
        .send({ amount: '1250.00', buyerAccountId: accountId });
      const reference = intentRes.body.data.intent.referenceCode as string;

      const upload = await http()
        .post('/v1/collections/statement-import')
        .set(auth(tokens.s1Admin!))
        .attach(
          'file',
          csv(['Tarih;Aciklama;Tutar', `2026-07-12;EFT ${reference};1.250,00`]),
          'e.csv',
        );

      const batchId = upload.body.data.batchId as string;
      const match = upload.body.data.matches[0] as { rowId: string; intentId: string };

      const body = { matches: [{ rowId: match.rowId, intentId: match.intentId }] };
      const first = await http()
        .post(`/v1/collections/statement-import/${batchId}/confirm`)
        .set(auth(tokens.s1Admin!))
        .send(body);
      expect(first.body.data.results[0].status).toBe('CONFIRMED');

      const balanceAfterFirst = await balanceOf(accountId, tokens.s1Admin!);
      expect(balanceAfterFirst).toBe('13000.00'); // 14.250 − 1.250

      // Ayni istegi tekrar gonder: satir zaten bagli → yeni CREDIT YOK.
      const second = await http()
        .post(`/v1/collections/statement-import/${batchId}/confirm`)
        .set(auth(tokens.s1Admin!))
        .send(body);
      expect(second.body.data.results[0].status).toBe('ALREADY_MATCHED');
      expect(second.body.data.confirmed).toBe(0);

      expect(await balanceOf(accountId, tokens.s1Admin!)).toBe('13000.00');

      // Intent'e bagli TEK bir CREDIT hareketi olmali.
      const credits = await rawPrisma.transaction.findMany({
        where: { collectIntentId: match.intentId },
      });
      expect(credits).toHaveLength(1);
    });

    it('IDEMPOTENT: manuel onay ikinci kez ALREADY_CONFIRMED verir', async () => {
      const intentRes = await http()
        .post('/v1/collections/intents')
        .set(auth(tokens.s1Admin!))
        .send({ amount: '1000.00', buyerAccountId: accountId });
      const intentId = intentRes.body.data.intent.id as string;

      const first = await http()
        .post(`/v1/collections/intents/${intentId}/confirm`)
        .set(auth(tokens.s1Admin!))
        .send({});
      expect(first.status).toBe(201);
      expect(first.body.data.alreadyConfirmed).toBe(false);
      expect(await balanceOf(accountId, tokens.s1Admin!)).toBe('12000.00'); // 13.000 − 1.000

      const second = await http()
        .post(`/v1/collections/intents/${intentId}/confirm`)
        .set(auth(tokens.s1Admin!))
        .send({});
      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe('ALREADY_CONFIRMED');

      expect(await balanceOf(accountId, tokens.s1Admin!)).toBe('12000.00');
    });

    it('KISMI odeme: gerceklesen islenir, FARK icin yeni talep acilir (§8)', async () => {
      const intentRes = await http()
        .post('/v1/collections/intents')
        .set(auth(tokens.s1Admin!))
        .send({ amount: '2000.00', buyerAccountId: accountId });
      const intentId = intentRes.body.data.intent.id as string;

      // Musteri 2.000 yerine 800 gondermis.
      const confirm = await http()
        .post(`/v1/collections/intents/${intentId}/confirm`)
        .set(auth(tokens.s1Admin!))
        .send({ amount: '800.00', note: 'Kismi odeme' });

      expect(confirm.body.data.creditedAmount).toBe('800.00');
      expect(confirm.body.data.remainderIntentId).toBeTruthy();

      // Bakiye yalniz GERCEKLESEN kadar duser: 12.000 − 800 = 11.200
      expect(await balanceOf(accountId, tokens.s1Admin!)).toBe('11200.00');

      // Kalan 1.200 icin YENI bekleyen talep.
      const remainder = await rawPrisma.collectIntent.findUniqueOrThrow({
        where: { id: confirm.body.data.remainderIntentId as string },
      });
      expect(remainder.amount.toString()).toBe('1200');
      expect(remainder.status).toBe('PENDING');
    });

    it('suresi dolmus talep onaylanamaz', async () => {
      const expired = await rawPrisma.collectIntent.create({
        data: {
          sellerId: ids.seller1Id,
          buyerAccountId: accountId,
          amount: '100.00',
          channel: 'BANK_TRANSFER',
          referenceCode: `S1-TAHS-001-EXPIRE`,
          status: 'EXPIRED',
          expiresAt: new Date('2026-07-01'),
        },
      });

      const res = await http()
        .post(`/v1/collections/intents/${expired.id}/confirm`)
        .set(auth(tokens.s1Admin!))
        .send({});
      expect(res.status).toBe(410);
      expect(res.body.error.code).toBe('INTENT_EXPIRED');
    });
  });

  // ================================================================ misafir sayfasi

  describe('Misafir odeme sayfasi (pay/{sellerSlug})', () => {
    it('kimliksiz talep acar (havale)', async () => {
      const res = await http()
        .post('/v1/collections/guest/anadolu-gida')
        .send({ accountCode: 'TAHS-001', amount: '300.00' });

      expect(res.status).toBe(201);
      expect(res.body.data.intent.referenceCode).toContain('TAHS-001');
      expect(res.body.data.bankAccounts).toHaveLength(1);
    });

    it('olmayan cari kodu VAR/YOK sizdirmaz — hatali tutarla ayni mesaj', async () => {
      const unknown = await http()
        .post('/v1/collections/guest/anadolu-gida')
        .send({ accountCode: 'BOYLE-BIR-CARI-YOK', amount: '300.00' });

      expect(unknown.status).toBe(400);
      expect(unknown.body.error.message).toBe(
        'Cari kodu veya tutar hatali. Lutfen bilgileri kontrol edin.',
      );
    });

    it('baska saticinin cari kodu o saticinin sayfasinda calismaz (tenant)', async () => {
      // TAHS-POS satici-2'nin carisi; satici-1'in sayfasinda bulunamamali.
      const res = await http()
        .post('/v1/collections/guest/anadolu-gida')
        .send({ accountCode: 'TAHS-POS', amount: '100.00' });
      expect(res.status).toBe(400);
    });
  });

  // ================================================================ KANAL 2: kart / POS

  describe('Kanal 2 — satici POS"u + hosted 3D', () => {
    /** Sandbox imzasi: gercek saglayicilarin deseni (HMAC-SHA256, alanlar | ile birlesir). */
    const sign = (parts: string[]): string =>
      createHmac('sha256', 'sandbox-secret').update(parts.join('|')).digest('hex');

    it('taksit secenekleri saglayicidan gelir (vade farki dahil)', async () => {
      const res = await http()
        .get('/v1/collections/installments?amount=10000.00')
        .set(auth(tokens.s2Admin!));

      expect(res.status).toBe(200);
      const single = res.body.data.find((o: { count: number }) => o.count === 1);
      const six = res.body.data.find((o: { count: number }) => o.count === 6);
      expect(single.totalAmount).toBe('10000.00'); // tek cekimde vade farki yok
      expect(six.totalAmount).toBe('10400.00'); // %4 vade farki
      expect(six.monthlyAmount).toBe('1733.33');
    });

    it('hosted 3D paketi: kart alani BIZDE degil, saglayicinin adresinde (kural #5)', async () => {
      const res = await http().post('/v1/collections/intents').set(auth(tokens.s2Admin!)).send({
        amount: '10000.00',
        buyerAccountId: cardAccountId,
        channel: 'CARD_POS',
        installmentCount: 6,
      });

      expect(res.status).toBe(201);
      const payment = res.body.data.payment;
      expect(payment.hostedUrl).not.toContain('localhost'); // kendi alan adimiz DEGIL
      expect(payment.fields.signature).toBeTruthy();
      expect(payment.debtAmount).toBe('10000.00'); // cariden dusecek
      expect(payment.chargeAmount).toBe('10400.00'); // karta cekilecek (vade farki bankanin)
    });

    it('UCTAN UCA: hosted odeme → IMZALI callback → bakiye duser (vade farki KADAR DEGIL)', async () => {
      expect(await balanceOf(cardAccountId, tokens.s2Admin!)).toBe('10000.00');

      const intentRes = await http()
        .post('/v1/collections/intents')
        .set(auth(tokens.s2Admin!))
        .send({
          amount: '4000.00',
          buyerAccountId: cardAccountId,
          channel: 'CARD_POS',
          installmentCount: 3,
        });
      const reference = intentRes.body.data.intent.referenceCode as string;
      const charged = intentRes.body.data.payment.chargeAmount as string;
      expect(charged).toBe('4080.00'); // %2 vade farki

      // Saglayici odemeyi onaylar ve BIZE callback atar.
      const callback = {
        merchantId: 'SANDBOX-MERCHANT-001',
        orderId: reference,
        amount: charged,
        installmentCount: 3,
        status: 'APPROVED',
        providerRef: 'SANDBOX-TXN-001',
        signature: sign([
          'SANDBOX-MERCHANT-001',
          reference,
          charged,
          'APPROVED',
          'SANDBOX-TXN-001',
        ]),
      };

      const res = await http().post('/v1/collections/pos-callback/SANDBOX').send(callback);
      expect(res.status).toBe(201);
      expect(res.body.data.processed).toBe(true);

      // Borctan DUSULEN: 4.000 (karta cekilen 4.080 degil — vade farki bankanin geliri).
      expect(await balanceOf(cardAccountId, tokens.s2Admin!)).toBe('6000.00');

      const credit = await rawPrisma.transaction.findFirstOrThrow({
        where: { collectIntentId: intentRes.body.data.intent.id as string },
      });
      expect(credit.amount.toString()).toBe('4000');
      expect(credit.documentType).toBe('PAYMENT');
    });

    it('IDEMPOTENT: ayni callback ikinci kez CREDIT yazmaz', async () => {
      const intentRes = await http()
        .post('/v1/collections/intents')
        .set(auth(tokens.s2Admin!))
        .send({ amount: '1000.00', buyerAccountId: cardAccountId, channel: 'CARD_POS' });
      const reference = intentRes.body.data.intent.referenceCode as string;

      const callback = {
        merchantId: 'SANDBOX-MERCHANT-001',
        orderId: reference,
        amount: '1000.00',
        installmentCount: 1,
        status: 'APPROVED',
        providerRef: 'SANDBOX-TXN-002',
        signature: sign([
          'SANDBOX-MERCHANT-001',
          reference,
          '1000.00',
          'APPROVED',
          'SANDBOX-TXN-002',
        ]),
      };

      const first = await http().post('/v1/collections/pos-callback/SANDBOX').send(callback);
      expect(first.body.data.processed).toBe(true);
      expect(await balanceOf(cardAccountId, tokens.s2Admin!)).toBe('5000.00');

      // Saglayici bildirimi TEKRARLAR (aglarda olagan) → ikinci kez islenmemeli.
      const second = await http().post('/v1/collections/pos-callback/SANDBOX').send(callback);
      expect(second.body.data.processed).toBe(false);
      expect(second.body.data.alreadyConfirmed).toBe(true);

      expect(await balanceOf(cardAccountId, tokens.s2Admin!)).toBe('5000.00');

      const credits = await rawPrisma.transaction.findMany({
        where: { collectIntentId: intentRes.body.data.intent.id as string },
      });
      expect(credits).toHaveLength(1);
    });

    it('IMZASIZ/SAHTE callback islenmez ve alarm uretir (§11.3)', async () => {
      const intentRes = await http()
        .post('/v1/collections/intents')
        .set(auth(tokens.s2Admin!))
        .send({ amount: '2500.00', buyerAccountId: cardAccountId, channel: 'CARD_POS' });
      const reference = intentRes.body.data.intent.referenceCode as string;
      const balanceBefore = await balanceOf(cardAccountId, tokens.s2Admin!);

      const res = await http()
        .post('/v1/collections/pos-callback/SANDBOX')
        .send({
          merchantId: 'SANDBOX-MERCHANT-001',
          orderId: reference,
          amount: '2500.00',
          installmentCount: 1,
          status: 'APPROVED',
          providerRef: 'SAHTE-TXN',
          signature: 'a'.repeat(64), // gecersiz imza
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('POS_SIGNATURE_INVALID');
      expect(await balanceOf(cardAccountId, tokens.s2Admin!)).toBe(balanceBefore);

      // Alarm: dogrulanamayan bildirim audit'e yazilir.
      const alarm = await rawPrisma.auditLog.findFirst({
        where: { action: 'POS_CALLBACK_REJECTED' },
        orderBy: { createdAt: 'desc' },
      });
      expect(alarm).toBeTruthy();
    });

    it('REDDEDILEN odemede talep PENDING kalir, bakiye degismez', async () => {
      const intentRes = await http()
        .post('/v1/collections/intents')
        .set(auth(tokens.s2Admin!))
        .send({ amount: '700.00', buyerAccountId: cardAccountId, channel: 'CARD_POS' });
      const reference = intentRes.body.data.intent.referenceCode as string;
      const balanceBefore = await balanceOf(cardAccountId, tokens.s2Admin!);

      const res = await http()
        .post('/v1/collections/pos-callback/SANDBOX')
        .send({
          merchantId: 'SANDBOX-MERCHANT-001',
          orderId: reference,
          amount: '700.00',
          installmentCount: 1,
          status: 'DECLINED',
          providerRef: 'SANDBOX-TXN-003',
          message: 'Yetersiz bakiye',
          signature: sign([
            'SANDBOX-MERCHANT-001',
            reference,
            '700.00',
            'DECLINED',
            'SANDBOX-TXN-003',
          ]),
        });

      expect(res.body.data.processed).toBe(false);
      expect(res.body.data.reason).toBe('DECLINED');
      expect(await balanceOf(cardAccountId, tokens.s2Admin!)).toBe(balanceBefore);

      const intent = await rawPrisma.collectIntent.findUniqueOrThrow({
        where: { id: intentRes.body.data.intent.id as string },
      });
      expect(intent.status).toBe('PENDING'); // musteri tekrar deneyebilir
    });

    it('POS"u olmayan satici kart kanalini acamaz', async () => {
      const res = await http()
        .post('/v1/collections/intents')
        .set(auth(tokens.s1Admin!)) // satici-1'in POS'u yok (seed)
        .send({ amount: '100.00', buyerAccountId: accountId, channel: 'CARD_POS' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('POS_NOT_CONFIGURED');
    });
  });

  // ================================================================ tenant izolasyonu

  describe('Tenant izolasyonu (kural #3)', () => {
    it('satici-2 satici-1"in tahsilat talebini goremez', async () => {
      const intentRes = await http()
        .post('/v1/collections/intents')
        .set(auth(tokens.s1Admin!))
        .send({ amount: '150.00', buyerAccountId: accountId });

      const res = await http()
        .get(`/v1/collections/intents/${intentRes.body.data.intent.id}`)
        .set(auth(tokens.s2Admin!));

      expect(res.status).toBe(404);
    });

    it('satici-2 satici-1"in talebini onaylayamaz', async () => {
      const intentRes = await http()
        .post('/v1/collections/intents')
        .set(auth(tokens.s1Admin!))
        .send({ amount: '160.00', buyerAccountId: accountId });

      const res = await http()
        .post(`/v1/collections/intents/${intentRes.body.data.intent.id}/confirm`)
        .set(auth(tokens.s2Admin!))
        .send({});

      expect(res.status).toBe(404);
      // Bakiye satici-1 tarafinda degismedi.
      expect(await balanceOf(accountId, tokens.s1Admin!)).toBe('11200.00');
    });

    it('listede yalniz kendi talepleri gorunur', async () => {
      const res = await http().get('/v1/collections/intents?limit=100').set(auth(tokens.s2Admin!));

      const sellerIds = new Set(
        (res.body.data as { buyerAccountId: string }[]).map((i) => i.buyerAccountId),
      );
      expect(sellerIds.has(accountId)).toBe(false);
    });
  });

  // ================================================================ satici ayarlari

  describe('Satici ayarlari — IBAN + POS (kritik islem)', () => {
    it('gecersiz IBAN reddedilir (mod-97)', async () => {
      const res = await http().post('/v1/sellers/bank-accounts').set(auth(tokens.s1Admin!)).send({
        bankName: 'Test Bankasi',
        iban: 'TR330006100519786457841327', // kontrol hanesi bozuk
        holderName: 'Anadolu Gida',
      });

      expect(res.status).toBe(400);
    });

    it('POS anahtarlari panelde MASKELI doner (§11.3)', async () => {
      const res = await http().get('/v1/sellers/pos-config').set(auth(tokens.s2Admin!));

      expect(res.status).toBe(200);
      expect(res.body.data.provider).toBe('SANDBOX');
      expect(res.body.data.apiKeyMasked).toContain('*');
      expect(res.body.data.apiKeyMasked).not.toContain('sandbox-api-key');
      expect(res.body.data.secretMasked).not.toContain('sandbox-secret');
    });

    it('POS tanimi SELLER_STAFF tarafindan degistirilemez', async () => {
      const staff = await login(USERS.seller1Staff);
      const res = await http().put('/v1/sellers/pos-config').set(auth(staff)).send({
        provider: 'SANDBOX',
        merchantId: 'HACK',
        apiKey: 'x',
        secret: 'y',
        isActive: true,
      });

      expect(res.status).toBe(403);
    });
  });
});
