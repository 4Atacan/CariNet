import { eq, gt, negate, sub, type MoneyString } from './money';

/**
 * CLAUDE.md §8 Kanal 1 — havale/EFT referans eslestirmesinin SAF cekirdegi.
 * Burada DB yok, IO yok: girdi ekstre satirlari + bekleyen intentler, cikti eslesme onerisi.
 * Boylece "hangi dekont hangi tahsilata gider" karari testle kanitlanabilir.
 */

/** Referans kodu formati (§7): S{sellerNo}-{accountCode}-{6 CSPRNG} */
export const REFERENCE_CODE_RANDOM_LENGTH = 6;

export const buildReferenceCode = (sellerNo: number, accountCode: string, random: string): string =>
  `S${sellerNo}-${accountCode}-${random.toUpperCase()}`;

/**
 * Banka aciklamalari kodu bozar: bosluk atar, kucuk harfe cevirir, noktalama ekler.
 * ("S1-CARI-001-A1B2C3" → "S1 CARI 001 A1B2C3" → "s1/cari/001/a1b2c3")
 * Bu yuzden karsilastirma alfanumerik cekirdek uzerinden yapilir.
 */
export const normalizeReference = (value: string): string =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * IBAN mod-97 dogrulamasi (ISO 13616). Yanlis IBAN = parayi baska hesaba yonlendirmek demek;
 * bu yuzden bicim kontrolu yetmez, kontrol hanesi de dogrulanir (§11.3 kritik islem).
 */
export function isValidIban(value: string): boolean {
  const iban = value.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = [...rearranged]
    .map((c) => (c >= 'A' && c <= 'Z' ? String(c.charCodeAt(0) - 55) : c))
    .join('');

  // 97'ye bolum: sayi cok uzun oldugu icin parcali mod alinir.
  let remainder = 0;
  for (const digit of digits) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export const normalizeIban = (value: string): string => value.replace(/\s/g, '').toUpperCase();

export type MatchConfidence = 'EXACT' | 'SUGGESTED' | 'NONE';

export interface PendingIntent {
  id: string;
  referenceCode: string;
  buyerAccountId: string | null;
  amount: MoneyString;
}

/** Cari kodu → hesap. Eski kodlar da gelir (account_code_history, §7). */
export interface AccountCodeRef {
  buyerAccountId: string;
  accountCode: string;
}

export interface StatementRowInput {
  id: string;
  description: string;
  amount: MoneyString;
}

export interface StatementMatch {
  rowId: string;
  confidence: MatchConfidence;
  intentId: string | null;
  buyerAccountId: string | null;
  /** Intent varsa: dekont tutari intent tutariyla birebir mi? */
  amountMatches: boolean;
  /** intent.amount − satir tutari. Pozitif → kismi odeme, negatif → fazla odeme. */
  difference: MoneyString | null;
  /** Panelde gosterilen Turkce gerekce. */
  reason: string;
}

/**
 * Iki gecisli eslestirme:
 *   1) Referans kodu aciklamada geciyorsa → EXACT (tutar tutmasa bile; fark ayrica raporlanir).
 *   2) Kalan satirlarda cari kodu geciyorsa → SUGGESTED (ayni tutarli bekleyen intent varsa ona,
 *      yoksa yalniz cariye) → insan onayi ister (§8 "aciklamasiz dekont").
 * Bir intent birden fazla satira baglanamaz: eslesen intent havuzdan cikar.
 */
export function matchStatementRows(
  rows: readonly StatementRowInput[],
  intents: readonly PendingIntent[],
  accountCodes: readonly AccountCodeRef[],
): StatementMatch[] {
  const available = new Map(intents.map((i) => [i.id, i]));
  const matches = new Map<string, StatementMatch>();

  // 1) Referans kodu — kesin eslesme.
  for (const row of rows) {
    const haystack = normalizeReference(row.description);
    const intent = [...available.values()].find((i) =>
      haystack.includes(normalizeReference(i.referenceCode)),
    );
    if (!intent) continue;

    available.delete(intent.id);
    matches.set(row.id, {
      rowId: row.id,
      confidence: 'EXACT',
      intentId: intent.id,
      buyerAccountId: intent.buyerAccountId,
      ...amountVerdict(intent.amount, row.amount),
    });
  }

  // 2) Cari kodu — oneri.
  for (const row of rows) {
    if (matches.has(row.id)) continue;
    const haystack = normalizeReference(row.description);

    // En uzun kod once: "CARI-1" ile "CARI-10" karismasin.
    const code = [...accountCodes]
      .sort((a, b) => b.accountCode.length - a.accountCode.length)
      .find((c) => haystack.includes(normalizeReference(c.accountCode)));

    if (!code) {
      matches.set(row.id, {
        rowId: row.id,
        confidence: 'NONE',
        intentId: null,
        buyerAccountId: null,
        amountMatches: false,
        difference: null,
        reason: 'Aciklamada referans kodu veya cari kodu bulunamadi',
      });
      continue;
    }

    const intent = [...available.values()].find(
      (i) => i.buyerAccountId === code.buyerAccountId && eq(i.amount, row.amount),
    );
    if (intent) {
      available.delete(intent.id);
      matches.set(row.id, {
        rowId: row.id,
        confidence: 'SUGGESTED',
        intentId: intent.id,
        buyerAccountId: code.buyerAccountId,
        amountMatches: true,
        difference: '0.00',
        reason: `Cari kodu (${code.accountCode}) ve tutar ayni bekleyen tahsilatla eslesti`,
      });
      continue;
    }

    matches.set(row.id, {
      rowId: row.id,
      confidence: 'SUGGESTED',
      intentId: null,
      buyerAccountId: code.buyerAccountId,
      amountMatches: false,
      difference: null,
      reason: `Aciklamada cari kodu (${code.accountCode}) gecti; bekleyen tahsilat yok`,
    });
  }

  return rows.map((row) => matches.get(row.id)!);
}

function amountVerdict(
  intentAmount: MoneyString,
  rowAmount: MoneyString,
): Pick<StatementMatch, 'amountMatches' | 'difference' | 'reason'> {
  const difference = sub(intentAmount, rowAmount);
  if (eq(difference, '0.00')) {
    return { amountMatches: true, difference, reason: 'Referans kodu ve tutar birebir eslesti' };
  }
  return {
    amountMatches: false,
    difference,
    reason: gt(difference, '0.00')
      ? `Referans kodu eslesti, tutar EKSIK (kalan ${difference})`
      : `Referans kodu eslesti, tutar FAZLA (${negate(difference)} fazla)`,
  };
}
