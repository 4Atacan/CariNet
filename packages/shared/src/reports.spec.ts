import { describe, expect, it } from 'vitest';
import {
  bucketOf,
  computeAging,
  computeAverageDue,
  limitUsagePercent,
  type LedgerItem,
} from './reports';

const ASOF = new Date('2026-07-14T00:00:00Z');

const debit = (id: string, amount: string, dueDate: string | null, documentDate = '2026-01-01') =>
  ({ id, type: 'DEBIT', amount, dueDate, documentDate }) satisfies LedgerItem;

const credit = (id: string, amount: string, documentDate = '2026-01-01') =>
  ({ id, type: 'CREDIT', amount, dueDate: null, documentDate }) satisfies LedgerItem;

describe('yaslandirma kovalari', () => {
  it('gun sayisini dogru kovaya atar (sinirlar dahil)', () => {
    expect(bucketOf(0)).toBe('NOT_DUE'); // bugun vadesi gelen henuz gecmis degil
    expect(bucketOf(-5)).toBe('NOT_DUE');
    expect(bucketOf(1)).toBe('D0_30');
    expect(bucketOf(30)).toBe('D0_30');
    expect(bucketOf(31)).toBe('D31_60');
    expect(bucketOf(60)).toBe('D31_60');
    expect(bucketOf(61)).toBe('D61_90');
    expect(bucketOf(90)).toBe('D61_90');
    expect(bucketOf(91)).toBe('D90_PLUS');
  });
});

describe('computeAging — FIFO tahsis', () => {
  it('alacak en ESKI borctan baslayarak kapatir', () => {
    const report = computeAging(
      [
        debit('d1', '1000.00', '2026-01-31'), // en eski → once kapanir
        debit('d2', '2000.00', '2026-06-30'),
        credit('c1', '1500.00'),
      ],
      ASOF,
    );

    // 1500 alacak: d1'in 1000'ini tamamen, d2'nin 500'unu kapatir
    expect(report.openItems).toHaveLength(1);
    expect(report.openItems[0]!.id).toBe('d2');
    expect(report.openItems[0]!.remaining).toBe('1500.00');
    expect(report.balance).toBe('1500.00');
  });

  it('vadesi gecen ve gecmeyen ayrimini dogru yapar', () => {
    const report = computeAging(
      [
        debit('gecmis', '1000.00', '2026-06-01'), // 43 gun gecmis → D31_60
        debit('gelecek', '3000.00', '2026-12-31'), // vadesi gelmemis
      ],
      ASOF,
    );

    expect(report.overdue).toBe('1000.00');
    expect(report.notDue).toBe('3000.00');
    expect(report.buckets.D31_60).toBe('1000.00');
    expect(report.buckets.NOT_DUE).toBe('3000.00');
    expect(report.balance).toBe('4000.00');
  });

  it('kovalarin toplami acik bakiyeye esittir (kurus kacagi yok)', () => {
    const report = computeAging(
      [
        debit('d1', '333.33', '2026-05-01'),
        debit('d2', '333.33', '2026-06-15'),
        debit('d3', '333.34', '2026-08-01'),
        credit('c1', '100.00'),
      ],
      ASOF,
    );

    const sumBuckets = Object.values(report.buckets).reduce((acc, v) => acc + Number(v), 0);
    expect(sumBuckets.toFixed(2)).toBe('900.00'); // 1000.00 − 100.00 alacak
    expect(report.balance).toBe('900.00');
  });

  it('fazla odeme bakiyeyi negatife dusurur, acik kalem birakmaz', () => {
    const report = computeAging(
      [debit('d1', '500.00', '2026-01-31'), credit('c1', '800.00')],
      ASOF,
    );

    expect(report.openItems).toHaveLength(0);
    expect(report.balance).toBe('-300.00'); // alici alacakli
    expect(report.overdue).toBe('0.00');
  });

  it('vadesi olmayan borc, belge tarihinden yaslandirilir (pesin islem)', () => {
    const report = computeAging([debit('d1', '100.00', null, '2026-01-01')], ASOF);
    expect(report.openItems[0]!.bucket).toBe('D90_PLUS'); // 194 gun
  });
});

describe('computeAverageDue — tutar agirlikli', () => {
  it('esit tutarlarda iki vadenin tam ortasini verir', () => {
    const report = computeAging(
      [debit('d1', '1000.00', '2026-01-01'), debit('d2', '1000.00', '2026-01-11')],
      ASOF,
    );
    const avg = computeAverageDue(report.openItems, ASOF);

    expect(avg.averageDueDate).toBe('2026-01-06'); // (1 Ocak + 11 Ocak) / 2
    expect(avg.weightedAmount).toBe('2000.00');
  });

  it('buyuk tutar ortalamayi kendi vadesine ceker (agirlik)', () => {
    const report = computeAging(
      [
        debit('kucuk', '1000.00', '2026-01-01'),
        debit('buyuk', '9000.00', '2026-01-11'), // 9 kat agirlik
      ],
      ASOF,
    );
    const avg = computeAverageDue(report.openItems, ASOF);

    // (1000×1 Ocak + 9000×11 Ocak) / 10000 = 10 Ocak
    expect(avg.averageDueDate).toBe('2026-01-10');
  });

  it('acik kalem yoksa null doner', () => {
    const avg = computeAverageDue([], ASOF);
    expect(avg.averageDueDate).toBeNull();
    expect(avg.weightedAmount).toBe('0.00');
  });

  it('ortalama vadenin kac gun gectigini hesaplar', () => {
    const report = computeAging([debit('d1', '1000.00', '2026-06-14')], ASOF);
    const avg = computeAverageDue(report.openItems, ASOF);
    expect(avg.averageOverdueDays).toBe(30);
  });
});

describe('limit kullanimi', () => {
  it('yuzdeyi bir ondalikla verir', () => {
    expect(limitUsagePercent('50000.00', '100000.00')).toBe(50);
    expect(limitUsagePercent('33333.00', '100000.00')).toBe(33.3);
    expect(limitUsagePercent('120000.00', '100000.00')).toBe(120); // limit asilmis
  });

  it('limit tanimsizsa (0) yuzde anlamsizdir → null', () => {
    expect(limitUsagePercent('5000.00', '0')).toBeNull();
  });
});
