import { TransactionType } from './enums';
import { add, gt, isZero, sub, toDecimal, toMoney, type MoneyString } from './money';

/**
 * CLAUDE.md §13 Faz 2 — Risk Foyu ve Ortalama Vade hesaplari.
 * Kural #1: her adim decimal.js; `number` ile parasal aritmetik YOK.
 * Kural #2: girdi daima hareketlerdir — hicbir sey saklanmaz, her cagride turetilir.
 */

/** Yaslandirma kovalari (§6.4). */
export const AGING_BUCKETS = ['NOT_DUE', 'D0_30', 'D31_60', 'D61_90', 'D90_PLUS'] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export interface LedgerItem {
  readonly id: string;
  readonly type: TransactionType;
  /** TRY karsiligi (kur satira sabit — §6.4). */
  readonly amount: MoneyString;
  readonly documentDate: string;
  readonly dueDate: string | null;
}

export interface OpenItem {
  readonly id: string;
  /** Odenmemis kalan tutar. */
  readonly remaining: MoneyString;
  readonly dueDate: string | null;
  readonly documentDate: string;
  readonly overdueDays: number;
  readonly bucket: AgingBucket;
}

export interface AgingReport {
  readonly balance: MoneyString;
  readonly overdue: MoneyString;
  readonly notDue: MoneyString;
  readonly buckets: Record<AgingBucket, MoneyString>;
  readonly openItems: readonly OpenItem[];
}

const MS_PER_DAY = 86_400_000;

const dayDiff = (from: Date, to: Date): number =>
  Math.floor((utcMidnight(to) - utcMidnight(from)) / MS_PER_DAY);

const utcMidnight = (d: Date): number =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export function bucketOf(overdueDays: number): AgingBucket {
  if (overdueDays <= 0) return 'NOT_DUE';
  if (overdueDays <= 30) return 'D0_30';
  if (overdueDays <= 60) return 'D31_60';
  if (overdueDays <= 90) return 'D61_90';
  return 'D90_PLUS';
}

/**
 * Yaslandirma: alacaklar (CREDIT) en ESKI borctan baslayarak kapatilir (FIFO).
 * Muhasebe pratigi budur; aksi halde "vadesi gecen" tutari sistematik olarak sisirilir.
 * Kalan acik kalemler vade gunune gore kovalara dagitilir.
 */
export function computeAging(items: readonly LedgerItem[], asOf: Date = new Date()): AgingReport {
  const debits = items
    .filter((i) => i.type === TransactionType.DEBIT)
    .slice()
    .sort(byAgeAsc);

  const totalCredit = items
    .filter((i) => i.type === TransactionType.CREDIT)
    .reduce<MoneyString>((acc, i) => add(acc, i.amount), '0.00');

  let unapplied = totalCredit;
  const openItems: OpenItem[] = [];

  for (const debit of debits) {
    let remaining = toMoney(debit.amount);

    if (!isZero(unapplied)) {
      if (gt(unapplied, remaining) || toDecimal(unapplied).equals(toDecimal(remaining))) {
        unapplied = sub(unapplied, remaining);
        remaining = '0.00';
      } else {
        remaining = sub(remaining, unapplied);
        unapplied = '0.00';
      }
    }

    if (isZero(remaining)) continue;

    // Vadesi yoksa belge tarihi vade sayilir (pesin islem).
    const due = debit.dueDate ?? debit.documentDate;
    const overdueDays = dayDiff(new Date(due), asOf);

    openItems.push({
      id: debit.id,
      remaining,
      dueDate: debit.dueDate,
      documentDate: debit.documentDate,
      overdueDays,
      bucket: bucketOf(overdueDays),
    });
  }

  const buckets = Object.fromEntries(AGING_BUCKETS.map((b) => [b, '0.00'])) as Record<
    AgingBucket,
    MoneyString
  >;
  for (const item of openItems) {
    buckets[item.bucket] = add(buckets[item.bucket], item.remaining);
  }

  const overdue = AGING_BUCKETS.filter((b) => b !== 'NOT_DUE').reduce<MoneyString>(
    (acc, b) => add(acc, buckets[b]),
    '0.00',
  );

  // Bakiye = Σ(DEBIT) − Σ(CREDIT); fazla odeme varsa NEGATIF olabilir (alici alacakli).
  const totalDebit = debits.reduce<MoneyString>((acc, i) => add(acc, i.amount), '0.00');

  return {
    balance: sub(totalDebit, totalCredit),
    overdue,
    notDue: buckets.NOT_DUE,
    buckets,
    openItems,
  };
}

/** Eski → yeni: once vade, vade yoksa belge tarihi. */
function byAgeAsc(a: LedgerItem, b: LedgerItem): number {
  const keyA = a.dueDate ?? a.documentDate;
  const keyB = b.dueDate ?? b.documentDate;
  if (keyA !== keyB) return keyA < keyB ? -1 : 1;
  return a.id < b.id ? -1 : 1; // deterministik siralama
}

export interface AverageDue {
  /** Tutar agirlikli ortalama vade tarihi (ISO gun). Acik kalem yoksa null. */
  readonly averageDueDate: string | null;
  /** asOf'a gore gun farki: pozitif = vadesi gecmis. */
  readonly averageOverdueDays: number | null;
  /** Agirlik toplami (acik bakiye). */
  readonly weightedAmount: MoneyString;
}

/**
 * Ortalama vade = TUTAR AGIRLIKLI (§6.4).
 *   ortalama = Σ(tutar_i × vade_i) / Σ(tutar_i)
 * Tarihler gun sayisina cevrilip agirliklandirilir; sonuc tekrar tarihe donusturulur.
 */
export function computeAverageDue(
  openItems: readonly OpenItem[],
  asOf: Date = new Date(),
): AverageDue {
  const total = openItems.reduce<MoneyString>((acc, i) => add(acc, i.remaining), '0.00');
  if (isZero(total)) {
    return { averageDueDate: null, averageOverdueDays: null, weightedAmount: '0.00' };
  }

  // Gun sayilari da decimal.js ile carpilir (agirliklar parasal).
  const weightedDays = openItems.reduce((acc, item) => {
    const due = item.dueDate ?? item.documentDate;
    const days = dayDiff(EPOCH, new Date(due));
    return acc.plus(toDecimal(item.remaining).times(days));
  }, toDecimal('0'));

  const averageDayFloat = weightedDays.dividedBy(toDecimal(total));
  const averageDay = averageDayFloat.toDecimalPlaces(0, 4 /* ROUND_HALF_UP */).toNumber();
  const averageDate = new Date(utcMidnight(EPOCH) + averageDay * MS_PER_DAY);

  return {
    averageDueDate: averageDate.toISOString().slice(0, 10),
    averageOverdueDays: dayDiff(averageDate, asOf),
    weightedAmount: total,
  };
}

const EPOCH = new Date(Date.UTC(1970, 0, 1));

export interface RiskRow {
  readonly buyerAccountId: string;
  readonly accountCode: string;
  readonly title: string;
  readonly creditLimit: MoneyString;
  readonly balance: MoneyString;
  readonly overdue: MoneyString;
  readonly notDue: MoneyString;
  readonly buckets: Record<AgingBucket, MoneyString>;
  /** Limit kullanimi yuzdesi (limit 0 ise null). */
  readonly limitUsagePercent: number | null;
  readonly averageDueDate: string | null;
  readonly averageOverdueDays: number | null;
}

/** Limit kullanimi — gosterim icin yuzde; limit 0/tanimsizsa anlamsizdir. */
export function limitUsagePercent(balance: MoneyString, creditLimit: MoneyString): number | null {
  if (isZero(creditLimit) || toDecimal(creditLimit).isNegative()) return null;
  return toDecimal(balance)
    .dividedBy(toDecimal(creditLimit))
    .times(100)
    .toDecimalPlaces(1, 4)
    .toNumber();
}
