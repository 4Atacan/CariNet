import { describe, expect, it } from 'vitest';
import {
  buildReferenceCode,
  isValidIban,
  matchStatementRows,
  normalizeReference,
  type AccountCodeRef,
  type PendingIntent,
  type StatementMatch,
  type StatementRowInput,
} from './collections';

const REF = buildReferenceCode(1, 'CARI-001', 'A1B2C3'); // S1-CARI-001-A1B2C3

const intents: PendingIntent[] = [
  { id: 'i1', referenceCode: REF, buyerAccountId: 'acc1', amount: '5000.00' },
  {
    id: 'i2',
    referenceCode: buildReferenceCode(1, 'CARI-002', 'D4E5F6'),
    buyerAccountId: 'acc2',
    amount: '12500.00',
  },
];

const codes: AccountCodeRef[] = [
  { buyerAccountId: 'acc1', accountCode: 'CARI-001' },
  { buyerAccountId: 'acc2', accountCode: 'CARI-002' },
];

const row = (id: string, description: string, amount: string): StatementRowInput => ({
  id,
  description,
  amount,
});

/** Tek satirlik eslestirme — noUncheckedIndexedAccess yuzunden sonuc acikca daraltilir. */
function matchOne(
  input: StatementRowInput,
  pool: readonly PendingIntent[] = intents,
  refs: readonly AccountCodeRef[] = codes,
): StatementMatch {
  const [match] = matchStatementRows([input], pool, refs);
  if (!match) throw new Error('Eslestirme sonucu bos donmemeli');
  return match;
}

describe('normalizeReference', () => {
  it('bankanin bozdugu kodu ayni cekirdege indirger', () => {
    expect(normalizeReference('s1 cari 001 a1b2c3')).toBe(normalizeReference(REF));
    expect(normalizeReference('S1/CARI/001-A1B2C3')).toBe('S1CARI001A1B2C3');
  });
});

describe('matchStatementRows', () => {
  it('referans kodu aciklamada geciyorsa EXACT eslesir', () => {
    const match = matchOne(row('r1', `EFT GELEN ${REF} BAKKALIM GIDA`, '5000.00'));
    expect(match.confidence).toBe('EXACT');
    expect(match.intentId).toBe('i1');
    expect(match.amountMatches).toBe(true);
    expect(match.difference).toBe('0.00');
  });

  it('banka kodu bozsa bile (bosluk/kucuk harf) eslesir', () => {
    const match = matchOne(row('r1', 'havale s1 cari 001 a1b2c3 aciklama', '5000.00'));
    expect(match.intentId).toBe('i1');
  });

  it('kismi odemede EXACT kalir ama fark raporlanir (§8: gerceklesen islenir)', () => {
    const match = matchOne(row('r1', `EFT ${REF}`, '2000.00'));
    expect(match.confidence).toBe('EXACT');
    expect(match.amountMatches).toBe(false);
    expect(match.difference).toBe('3000.00'); // kalan borc → yeni talep acilir
  });

  it('fazla odemede fark negatiftir', () => {
    const match = matchOne(row('r1', `EFT ${REF}`, '6000.00'));
    expect(match.difference).toBe('-1000.00');
    expect(match.reason).toContain('FAZLA');
  });

  it('bir intent iki satira baglanamaz — ikinci satir intentsiz kalir', () => {
    const [first, second] = matchStatementRows(
      [row('r1', `EFT ${REF}`, '5000.00'), row('r2', `EFT ${REF} TEKRAR`, '5000.00')],
      intents,
      codes,
    );
    expect(first?.intentId).toBe('i1');
    expect(second?.intentId).toBeNull();
    // Cari kodu aciklamada gectigi icin yine de cariye onerilir — ama YENI tahsilat olarak.
    expect(second?.confidence).toBe('SUGGESTED');
    expect(second?.buyerAccountId).toBe('acc1');
  });

  it('referans yoksa cari kodu + ayni tutar → SUGGESTED intent', () => {
    const match = matchOne(row('r1', 'HAVALE CARI-002 MARKETIM TIC', '12500.00'));
    expect(match.confidence).toBe('SUGGESTED');
    expect(match.intentId).toBe('i2');
    expect(match.amountMatches).toBe(true);
  });

  it('cari kodu var ama tutar tutmuyorsa intent onerilmez (insan onayi)', () => {
    const match = matchOne(row('r1', 'HAVALE CARI-002 MARKETIM TIC', '999.00'));
    expect(match.confidence).toBe('SUGGESTED');
    expect(match.intentId).toBeNull();
    expect(match.buyerAccountId).toBe('acc2');
  });

  it('aciklamasiz dekont NONE dondurur (§8 kenar durum)', () => {
    const match = matchOne(row('r1', 'FAST GELEN ACIKLAMASIZ', '3200.00'));
    expect(match.confidence).toBe('NONE');
    expect(match.intentId).toBeNull();
    expect(match.buyerAccountId).toBeNull();
  });

  it('uzun kod once denenir: CARI-1 ile CARI-10 karismaz', () => {
    const ambiguous: AccountCodeRef[] = [
      { buyerAccountId: 'short', accountCode: 'CARI-1' },
      { buyerAccountId: 'long', accountCode: 'CARI-10' },
    ];
    const match = matchOne(row('r1', 'HAVALE CARI-10', '100.00'), [], ambiguous);
    expect(match.buyerAccountId).toBe('long');
  });

  it('eski cari kodu da eslesir (account_code_history)', () => {
    const withHistory: AccountCodeRef[] = [
      ...codes,
      { buyerAccountId: 'acc1', accountCode: 'ESKI-KOD-9' },
    ];
    const match = matchOne(row('r1', 'HAVALE ESKI-KOD-9 ODEME', '750.00'), [], withHistory);
    expect(match.buyerAccountId).toBe('acc1');
  });

  it('cikti sirasi girdi sirasiyla ayni kalir', () => {
    const result = matchStatementRows(
      [row('r1', 'ACIKLAMASIZ', '1.00'), row('r2', `EFT ${REF}`, '5000.00')],
      intents,
      codes,
    );
    expect(result.map((m) => m.rowId)).toEqual(['r1', 'r2']);
  });
});

describe('isValidIban', () => {
  it('gecerli TR IBAN kabul edilir (bosluklu yazim dahil)', () => {
    expect(isValidIban('TR33 0006 1005 1978 6457 8413 26')).toBe(true);
    expect(isValidIban('TR180006200119000006672315')).toBe(true);
  });

  it('tek hane degisen IBAN reddedilir (kontrol hanesi tutmaz)', () => {
    expect(isValidIban('TR330006100519786457841327')).toBe(false);
  });

  it('bicimi bozuk IBAN reddedilir', () => {
    expect(isValidIban('TR33')).toBe(false);
    expect(isValidIban('1234567890')).toBe(false);
  });
});
