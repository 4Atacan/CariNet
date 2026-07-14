#!/usr/bin/env node
/**
 * Sandbox POS callback simulatoru (§8 Kanal 2 — yalniz LOKAL TEST icin).
 *
 * Neden gerekli: kart formu bizde YOK (kural #5). Gercek akista kullanici saglayicinin
 * hosted 3D sayfasinda odeme yapar, saglayici da bize IMZALI bir callback atar. Lokalde
 * gercek bir saglayici olmadigi icin bu script o callback'i saglayici gibi imzalayip gonderir.
 *
 * Kullanim:
 *   node scripts/sandbox-pos-callback.mjs S2-CARI-001-AB12CD 1000.00
 *   node scripts/sandbox-pos-callback.mjs S2-CARI-001-AB12CD 1000.00 --declined
 *   node scripts/sandbox-pos-callback.mjs S2-CARI-001-AB12CD 1000.00 --taksit 6
 *
 * Referans kodunu mobil "Odeme Yap" ekranindan veya panel > Tahsilat listesinden alirsin.
 * Ayni komutu IKI KEZ calistir: ikincisinde bakiye DEGISMEMELI (idempotency).
 */
import { createHmac } from 'node:crypto';

// Seed'deki sandbox POS bilgileri (apps/api/prisma/seed.ts). Gercek anahtar degildir.
const MERCHANT_ID = 'SANDBOX-MERCHANT-001';
const SECRET = 'sandbox-secret';
const API = process.env.API_URL ?? 'http://localhost:3001/v1';

const args = process.argv.slice(2);
const [referenceCode, amount] = args;
const declined = args.includes('--declined');
const taksitIndex = args.indexOf('--taksit');
const installmentCount = taksitIndex >= 0 ? Number(args[taksitIndex + 1]) : 1;

if (!referenceCode || !amount) {
  console.error('Kullanim: node scripts/sandbox-pos-callback.mjs <REFERANS-KODU> <TUTAR>');
  console.error('Ornek:    node scripts/sandbox-pos-callback.mjs S2-CARI-001-AB12CD 1000.00');
  process.exit(1);
}
if (!/^\d+\.\d{2}$/.test(amount)) {
  console.error('Tutar "1000.00" biciminde olmali (iki ondalik).');
  process.exit(1);
}

const status = declined ? 'DECLINED' : 'APPROVED';
const providerRef = `SANDBOX-TXN-${Date.now()}`;

// Saglayicinin imza semasi (bkz. sandbox-pos.adapter.ts): HMAC-SHA256, alanlar "|" ile birlesir.
const signature = createHmac('sha256', SECRET)
  .update([MERCHANT_ID, referenceCode, amount, status, providerRef].join('|'))
  .digest('hex');

const body = {
  merchantId: MERCHANT_ID,
  orderId: referenceCode,
  amount,
  installmentCount,
  status,
  providerRef,
  ...(declined ? { message: 'Yetersiz bakiye' } : {}),
  signature,
};

const res = await fetch(`${API}/collections/pos-callback/SANDBOX`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const json = await res.json();

console.log(`\n${status} · ${amount} TL · ${installmentCount} taksit · ${referenceCode}`);
console.log('HTTP', res.status);
console.log(JSON.stringify(json, null, 2));

if (json?.data?.alreadyConfirmed) {
  console.log('\n→ Bu tahsilat DAHA ONCE islenmis. Yeni CREDIT yazilmadi, bakiye degismedi.');
} else if (json?.data?.processed) {
  console.log('\n→ Tahsilat islendi. Cari bakiyesi INTENT tutari kadar dustu.');
  console.log('  (Taksit vade farki bankaya aittir; bakiyeye yansimaz.)');
}
