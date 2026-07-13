/**
 * CLAUDE.md §4 — DEGISMEZ seed kurgusu:
 *   2 satici (izolasyon testinin on kosulu)
 *   satici-1: admin + 3 cari (biri coklu-uyelikli; kullanicisi satici-2'de de cari)
 *   60+ hareket (farkli vadeler, 1 dovizli fatura, 1 DEVIR kaydi)
 *   1 bekleyen collect_intent + ornek banka ekstresi CSV'si
 *   satici-2: sandbox POS configli · 2 urun, 1 kampanya
 */
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, type Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { encryptSecret } from '../src/common/crypto/encryption';

const prisma = new PrismaClient();

const SEED_PASSWORD = 'CariNet2026!';
const MASTER_KEY = process.env.MASTER_ENCRYPTION_KEY ?? '0'.repeat(64);

const day = (offsetDays: number): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
};

/** Referans kodu formati: S{sellerNo}-{accountCode}-{6 CSPRNG} (§7) */
const referenceCode = (sellerNo: number, accountCode: string): string =>
  `S${sellerNo}-${accountCode}-${randomBytes(4).toString('hex').slice(0, 6).toUpperCase()}`;

async function reset(): Promise<void> {
  // Seed idempotent: tablolari bosalt (yalniz lokal/test — prod'da CALISTIRILMAZ).
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_logs, notifications, import_rows, import_batches, bank_statement_rows,
      collect_intents, seller_pos_configs, seller_bank_accounts, addresses, campaigns,
      stocks, products, invoice_items, invoices, transactions, representatives,
      account_code_history, account_memberships, invites, seller_members,
      password_reset_tokens, refresh_tokens, buyer_accounts, users, sellers, exchange_rates
    RESTART IDENTITY CASCADE;
  `);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed production ortaminda calistirilamaz.');
  }

  await reset();
  const passwordHash = await argon2.hash(SEED_PASSWORD, { type: argon2.argon2id });

  // ------------------------------------------------------------------ saticilar
  const seller1 = await prisma.seller.create({
    data: { name: 'Anadolu Gida Toptan A.S.', slug: 'anadolu-gida' },
  });
  const seller2 = await prisma.seller.create({
    data: { name: 'Ege Tekstil Ltd. Sti.', slug: 'ege-tekstil' },
  });

  // ------------------------------------------------------------------ kullanicilar (kuresel kimlik §6.2)
  const platformAdmin = await prisma.user.create({
    data: {
      email: 'admin@carinet.local',
      fullName: 'Platform Yoneticisi',
      passwordHash,
      isPlatformAdmin: true,
    },
  });

  const s1Admin = await prisma.user.create({
    data: { email: 'admin@anadolugida.com', fullName: 'Ayse Yilmaz', passwordHash },
  });
  const s1Staff = await prisma.user.create({
    data: { email: 'personel@anadolugida.com', fullName: 'Burak Demir', passwordHash },
  });
  const s2Admin = await prisma.user.create({
    data: { email: 'admin@egetekstil.com', fullName: 'Cem Kaya', passwordHash },
  });

  const buyer1 = await prisma.user.create({
    data: { email: 'ahmet@bakkalim.com', fullName: 'Ahmet Sahin', passwordHash },
  });
  const buyer2 = await prisma.user.create({
    data: { email: 'zeynep@marketim.com', fullName: 'Zeynep Aydin', passwordHash },
  });
  /** COKLU UYELIK (§6.2): hem satici-1'de hem satici-2'de cari. */
  const buyerMulti = await prisma.user.create({
    data: { email: 'mehmet@zincirmarket.com', fullName: 'Mehmet Ozturk', passwordHash },
  });

  await prisma.sellerMember.createMany({
    data: [
      { userId: s1Admin.id, sellerId: seller1.id, role: 'ADMIN' },
      { userId: s1Staff.id, sellerId: seller1.id, role: 'STAFF' },
      { userId: s2Admin.id, sellerId: seller2.id, role: 'ADMIN' },
    ],
  });

  // ------------------------------------------------------------------ temsilciler + cariler
  const rep1 = await prisma.representative.create({
    data: { sellerId: seller1.id, fullName: 'Deniz Arslan', phone: '+905321112233' },
  });
  const rep2 = await prisma.representative.create({
    data: { sellerId: seller1.id, fullName: 'Elif Koc', phone: '+905324445566' },
  });

  const a1 = await prisma.buyerAccount.create({
    data: {
      sellerId: seller1.id,
      accountCode: '120.01.001',
      title: 'Bakkalim Gida Ltd.',
      vknTckn: '1234567890',
      creditLimit: '50000.00',
      representativeId: rep1.id,
    },
  });
  const a2 = await prisma.buyerAccount.create({
    data: {
      sellerId: seller1.id,
      accountCode: '120.01.002',
      title: 'Marketim Ticaret A.S.',
      vknTckn: '2345678901',
      creditLimit: '120000.00',
      representativeId: rep2.id,
    },
  });
  const a3 = await prisma.buyerAccount.create({
    data: {
      sellerId: seller1.id,
      accountCode: '120.01.003',
      title: 'Zincir Market San. Tic.',
      vknTckn: '3456789012',
      creditLimit: '250000.00',
      representativeId: rep1.id,
    },
  });
  /** Ayni kullanicinin satici-2'deki carisi — coklu uyeligin diger ucu. */
  const b1 = await prisma.buyerAccount.create({
    data: {
      sellerId: seller2.id,
      accountCode: 'CARI-001',
      title: 'Zincir Market San. Tic.',
      vknTckn: '3456789012',
      creditLimit: '80000.00',
    },
  });

  await prisma.accountMembership.createMany({
    data: [
      { userId: buyer1.id, buyerAccountId: a1.id, invitedById: s1Admin.id },
      { userId: buyer2.id, buyerAccountId: a2.id, invitedById: s1Admin.id },
      { userId: buyerMulti.id, buyerAccountId: a3.id, invitedById: s1Admin.id },
      { userId: buyerMulti.id, buyerAccountId: b1.id, invitedById: s2Admin.id },
    ],
  });

  await prisma.address.createMany({
    data: [
      {
        buyerAccountId: a1.id,
        label: 'Merkez',
        fullAddress: 'Cumhuriyet Cad. No:12',
        city: 'Istanbul',
      },
      { buyerAccountId: a3.id, label: 'Depo', fullAddress: 'OSB 3. Cad. No:45', city: 'Kocaeli' },
    ],
  });

  // ------------------------------------------------------------------ hareketler (60+, kural #2)
  const transactions: Prisma.TransactionCreateManyInput[] = [];
  const accounts = [a1, a2, a3];

  // 1) DEVIR kayitlari — her carinin kesim gunundeki bakiyesi (§9)
  const openingAmounts = ['15750.00', '42300.50', '88900.00'];
  accounts.forEach((account, i) => {
    transactions.push({
      sellerId: seller1.id,
      buyerAccountId: account.id,
      type: 'DEBIT',
      documentType: 'OPENING_BALANCE',
      documentDate: day(-180),
      amount: openingAmounts[i]!,
      description: 'Devir bakiyesi (kesim tarihi 01.01.2026)',
      createdById: s1Admin.id,
    });
  });

  // 2) Rutin fatura + tahsilat hareketleri — farkli vadeler
  let counter = 0;
  for (let i = 0; i < 60; i++) {
    const account = accounts[i % 3]!;
    const isPayment = i % 4 === 3;
    const docDate = day(-170 + i * 2);
    counter += 1;

    transactions.push(
      isPayment
        ? {
            sellerId: seller1.id,
            buyerAccountId: account.id,
            type: 'CREDIT',
            documentType: 'PAYMENT',
            documentNo: `THS-${String(counter).padStart(4, '0')}`,
            documentDate: docDate,
            amount: (2000 + ((i * 137) % 9000)).toFixed(2),
            description: 'Havale ile tahsilat',
            createdById: s1Admin.id,
          }
        : {
            sellerId: seller1.id,
            buyerAccountId: account.id,
            type: 'DEBIT',
            documentType: 'SALES_INVOICE',
            documentNo: `AGT2026${String(counter).padStart(6, '0')}`,
            documentDate: docDate,
            // Farkli vadeler: 0 / 30 / 45 / 60 gun
            dueDate: day(-170 + i * 2 + [0, 30, 45, 60][i % 4]!),
            amount: (1500 + ((i * 311) % 14000)).toFixed(2),
            description: 'Mal satisi',
            createdById: s1Admin.id,
          },
    );
  }
  await prisma.transaction.createMany({ data: transactions });

  // ------------------------------------------------------------------ faturalar (biri DOVIZLI)
  const tryInvoice = await prisma.invoice.create({
    data: {
      sellerId: seller1.id,
      buyerAccountId: a1.id,
      invoiceNo: 'AGT2026000101',
      invoiceDate: day(-20),
      dueDate: day(10),
      currencyCode: 'TRY',
      exchangeRate: '1.0000',
      netTotal: '10000.00',
      taxTotal: '2000.00',
      grandTotal: '12000.00',
      items: {
        create: [
          {
            lineNo: 1,
            name: 'Ayçicek Yagi 5L',
            unit: 'KOLI',
            quantity: '100.0000',
            unitPrice: '60.00',
            taxRate: '20.00',
            netTotal: '6000.00',
            taxAmount: '1200.00',
            lineTotal: '7200.00',
          },
          {
            lineNo: 2,
            name: 'Toz Seker 25kg',
            unit: 'CUVAL',
            quantity: '80.0000',
            unitPrice: '50.00',
            taxRate: '20.00',
            netTotal: '4000.00',
            taxAmount: '800.00',
            lineTotal: '4800.00',
          },
        ],
      },
    },
  });

  /** DOVIZLI fatura — kur satira sabitlenir (§7). */
  const usdInvoice = await prisma.invoice.create({
    data: {
      sellerId: seller1.id,
      buyerAccountId: a3.id,
      invoiceNo: 'AGT2026000102',
      invoiceDate: day(-15),
      dueDate: day(15),
      currencyCode: 'USD',
      exchangeRate: '38.4210',
      netTotal: '5000.00',
      taxTotal: '1000.00',
      grandTotal: '6000.00',
      items: {
        create: [
          {
            lineNo: 1,
            name: 'Ithal Kakao 10kg',
            unit: 'KOLI',
            quantity: '50.0000',
            unitPrice: '100.00',
            taxRate: '20.00',
            netTotal: '5000.00',
            taxAmount: '1000.00',
            lineTotal: '6000.00',
            exchangeRate: '38.4210',
          },
        ],
      },
    },
  });

  await prisma.transaction.createMany({
    data: [
      {
        sellerId: seller1.id,
        buyerAccountId: a1.id,
        type: 'DEBIT',
        documentType: 'SALES_INVOICE',
        documentNo: tryInvoice.invoiceNo,
        documentDate: tryInvoice.invoiceDate,
        dueDate: tryInvoice.dueDate,
        amount: '12000.00',
        invoiceId: tryInvoice.id,
        description: 'Satis faturasi',
      },
      {
        sellerId: seller1.id,
        buyerAccountId: a3.id,
        type: 'DEBIT',
        documentType: 'SALES_INVOICE',
        documentNo: usdInvoice.invoiceNo,
        documentDate: usdInvoice.invoiceDate,
        dueDate: usdInvoice.dueDate,
        amount: '6000.00',
        currencyCode: 'USD',
        exchangeRate: '38.4210',
        invoiceId: usdInvoice.id,
        description: 'Dovizli satis faturasi',
      },
    ],
  });

  // ------------------------------------------------------------------ banka hesabi + bekleyen tahsilat (§8)
  await prisma.sellerBankAccount.create({
    data: {
      sellerId: seller1.id,
      bankName: 'Ziraat Bankasi',
      iban: 'TR330006100519786457841326',
      holderName: 'Anadolu Gida Toptan A.S.',
    },
  });

  const pendingRef = referenceCode(1, a1.accountCode);
  await prisma.collectIntent.create({
    data: {
      sellerId: seller1.id,
      buyerAccountId: a1.id,
      amount: '5000.00',
      channel: 'BANK_TRANSFER',
      referenceCode: pendingRef,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 saat (§8)
    },
  });

  // Ornek banka ekstresi CSV'si — Faz 3 eslestirme akisinin girdisi.
  const csvPath = join(__dirname, 'fixtures', 'banka-ekstresi-ornek.csv');
  const csv = [
    'Tarih;Aciklama;Tutar',
    `${day(-1).toISOString().slice(0, 10)};EFT GELEN ${pendingRef} BAKKALIM GIDA;5000,00`,
    `${day(-2).toISOString().slice(0, 10)};HAVALE ${a2.accountCode} MARKETIM TIC;12500,00`,
    `${day(-3).toISOString().slice(0, 10)};FAST GELEN ACIKLAMASIZ;3200,00`,
  ].join('\n');
  writeFileSync(csvPath, `${csv}\n`, 'utf8');

  // ------------------------------------------------------------------ satici-2: sandbox POS (kural #5/#10)
  await prisma.sellerPosConfig.create({
    data: {
      sellerId: seller2.id,
      provider: 'SANDBOX',
      merchantId: 'SANDBOX-MERCHANT-001',
      apiKeyEnc: encryptSecret('sandbox-api-key', MASTER_KEY),
      secretEnc: encryptSecret('sandbox-secret', MASTER_KEY),
      isActive: true,
    },
  });
  await prisma.sellerBankAccount.create({
    data: {
      sellerId: seller2.id,
      bankName: 'Is Bankasi',
      iban: 'TR120006200119000006672315',
      holderName: 'Ege Tekstil Ltd. Sti.',
    },
  });

  // Satici-2 hareketleri (izolasyon testinde "digerinin verisi" olarak kullanilir)
  await prisma.transaction.createMany({
    data: [
      {
        sellerId: seller2.id,
        buyerAccountId: b1.id,
        type: 'DEBIT',
        documentType: 'OPENING_BALANCE',
        documentDate: day(-90),
        amount: '25000.00',
        description: 'Devir bakiyesi',
      },
      {
        sellerId: seller2.id,
        buyerAccountId: b1.id,
        type: 'DEBIT',
        documentType: 'SALES_INVOICE',
        documentNo: 'ET2026000001',
        documentDate: day(-30),
        dueDate: day(0),
        amount: '18500.00',
        description: 'Kumas satisi',
      },
      {
        sellerId: seller2.id,
        buyerAccountId: b1.id,
        type: 'CREDIT',
        documentType: 'PAYMENT',
        documentNo: 'ET-THS-001',
        documentDate: day(-10),
        amount: '10000.00',
        description: 'Havale ile tahsilat',
      },
    ],
  });

  // ------------------------------------------------------------------ vitrin: urunler + kampanya
  for (const [seller, products] of [
    [
      seller1,
      [
        { code: 'URN-001', name: 'Aycicek Yagi 5L', unit: 'KOLI', price: '60.00', quantity: '450' },
        { code: 'URN-002', name: 'Toz Seker 25kg', unit: 'CUVAL', price: '50.00', quantity: '300' },
      ],
    ],
    [
      seller2,
      [
        { code: 'TEK-001', name: 'Pamuklu Kumas', unit: 'METRE', price: '85.50', quantity: '1200' },
        { code: 'TEK-002', name: 'Polyester Iplik', unit: 'KG', price: '120.00', quantity: '600' },
      ],
    ],
  ] as const) {
    for (const p of products) {
      const product = await prisma.product.create({
        data: {
          sellerId: seller.id,
          code: p.code,
          name: p.name,
          unit: p.unit,
          price: p.price,
        },
      });
      await prisma.stock.create({
        data: { sellerId: seller.id, productId: product.id, quantity: `${p.quantity}.0000` },
      });
    }
    await prisma.campaign.create({
      data: {
        sellerId: seller.id,
        title: 'Ay sonu kampanyasi',
        body: 'Bu ay 50.000 TL uzeri alimlarda %5 ek iskonto.',
        startsAt: day(-5),
        endsAt: day(25),
      },
    });
  }

  // ------------------------------------------------------------------ TCMB kuru (ornek)
  await prisma.exchangeRate.createMany({
    data: [
      { date: day(0), currencyCode: 'USD', rate: '38.4210' },
      { date: day(0), currencyCode: 'EUR', rate: '41.7350' },
    ],
  });

  const counts = {
    satici: await prisma.seller.count(),
    kullanici: await prisma.user.count(),
    cari: await prisma.buyerAccount.count(),
    hareket: await prisma.transaction.count(),
    fatura: await prisma.invoice.count(),
  };

  // eslint-disable-next-line no-console
  console.log('Seed tamam:', counts, `\nSifre (tum kullanicilar): ${SEED_PASSWORD}`, {
    platformAdmin: platformAdmin.email,
    saticiAdmin: s1Admin.email,
    coklUyelikliAlici: buyerMulti.email,
    bekleyenTahsilatRef: pendingRef,
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
