import { describe, expect, it } from 'vitest';
import { ImportTarget } from './enums';
import { cellToDate, cellToMoney, cellToText, neutralizeFormula } from './import-cells';
import { autoMap, normalizeHeader } from './import-mapping';
import { openingBalanceRowSchema, transactionRowSchema } from './schemas/imports';

describe('hucre normalizasyonu (§11.3 — import saldiri yuzeyidir)', () => {
  it('formul enjeksiyonunu etkisiz hale getirir', () => {
    expect(neutralizeFormula('=CMD|calc!A1')).toBe("'=CMD|calc!A1");
    expect(neutralizeFormula('+1+1')).toBe("'+1+1");
    expect(neutralizeFormula('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(neutralizeFormula('Bakkalim Gida')).toBe('Bakkalim Gida'); // masum metin bozulmaz
  });

  it('metin hucresindeki formulu de etkisizlestirir', () => {
    expect(cellToText('  =1+1  ')).toBe("'=1+1");
    expect(cellToText('')).toBeUndefined();
    expect(cellToText(null)).toBeUndefined();
  });

  it('Turkce ve Ingilizce sayi bicimlerini ayirt eder', () => {
    expect(cellToMoney('1.234,56')).toBe('1234.56'); // TR
    expect(cellToMoney('1,234.56')).toBe('1234.56'); // EN
    expect(cellToMoney('1234,5')).toBe('1234.50');
    expect(cellToMoney('1234.5')).toBe('1234.50');
    expect(cellToMoney('12.345')).toBe('12.35'); // tek ayirici, ondalik kabul → yuvarlanir
  });

  it('parantezli ve isaretli negatifleri cozer (muhasebe disa aktarimi)', () => {
    expect(cellToMoney('(1.234,56)')).toBe('-1234.56');
    expect(cellToMoney('-500')).toBe('-500.00');
    expect(cellToMoney('1.234,56 ₺')).toBe('1234.56');
  });

  it('sayi olmayan hucreyi reddeder', () => {
    expect(cellToMoney('abc')).toBeUndefined();
    expect(cellToMoney('')).toBeUndefined();
    expect(cellToMoney('=1+1')).toBeUndefined();
  });

  it('tarih bicimlerini ve Excel seri numarasini cozer', () => {
    expect(cellToDate('01.02.2026')?.toISOString().slice(0, 10)).toBe('2026-02-01');
    expect(cellToDate('2026-02-01')?.toISOString().slice(0, 10)).toBe('2026-02-01');
    expect(cellToDate(46054)?.toISOString().slice(0, 10)).toBe('2026-02-01'); // Excel seri
    expect(cellToDate('31.02.2026')).toBeUndefined(); // tasan tarih reddedilir
    expect(cellToDate('yarin')).toBeUndefined();
  });
});

describe('kolon eslemesi (§9)', () => {
  it('Turkce basliklari sadelestirir', () => {
    expect(normalizeHeader('Cari Kodu')).toBe('carikodu');
    expect(normalizeHeader('VKN / TCKN')).toBe('vkntckn');
    expect(normalizeHeader('Borç')).toBe('borc');
  });

  it('muhasebe disa aktarimi basliklarini otomatik esler', () => {
    const { mapping, missing } = autoMap(
      ['Cari Kodu', 'Belge Tarihi', 'Vade', 'Borç', 'Alacak', 'Açıklama', 'Bilinmeyen Kolon'],
      ImportTarget.TRANSACTIONS,
    );

    expect(mapping.accountCode).toBe('Cari Kodu');
    expect(mapping.documentDate).toBe('Belge Tarihi');
    expect(mapping.debit).toBe('Borç');
    expect(mapping.credit).toBe('Alacak');
    expect(missing).toEqual([]); // zorunlu alanlar bulundu
  });

  it('zorunlu alan bulunamazsa bildirir (panel kullaniciya sorar)', () => {
    const { missing } = autoMap(['Tutar', 'Aciklama'], ImportTarget.TRANSACTIONS);
    expect(missing).toEqual(['accountCode', 'documentDate']);
  });
});

describe('satir semalari — yon ve tutar (kural #2)', () => {
  it('borc kolonu DEBIT, alacak kolonu CREDIT uretir', () => {
    const debit = transactionRowSchema.parse({
      accountCode: '120.01.001',
      documentDate: '2026-01-15',
      debit: '1500.00',
    });
    expect(debit).toMatchObject({ type: 'DEBIT', amount: '1500.00' });

    const credit = transactionRowSchema.parse({
      accountCode: '120.01.001',
      documentDate: '2026-01-15',
      credit: '750.50',
    });
    expect(credit).toMatchObject({ type: 'CREDIT', amount: '750.50' });
  });

  it('borc ve alacak ayni satirda doluysa net fark alinir', () => {
    const row = transactionRowSchema.parse({
      accountCode: '120.01.001',
      documentDate: '2026-01-15',
      debit: '1000.00',
      credit: '1200.00',
    });
    expect(row).toMatchObject({ type: 'CREDIT', amount: '200.00' }); // net alacak
  });

  it('tutarsiz satir reddedilir (sifir dahil)', () => {
    expect(
      transactionRowSchema.safeParse({ accountCode: '120.01.001', documentDate: '2026-01-15' })
        .success,
    ).toBe(false);

    expect(
      transactionRowSchema.safeParse({
        accountCode: '120.01.001',
        documentDate: '2026-01-15',
        debit: '0',
        credit: '0',
      }).success,
    ).toBe(false);
  });

  it('devir: negatif bakiye alacakli devir demektir', () => {
    expect(
      openingBalanceRowSchema.parse({ accountCode: 'C-1', balance: '-2500.00' }),
    ).toMatchObject({ type: 'CREDIT', amount: '2500.00' });
    expect(openingBalanceRowSchema.parse({ accountCode: 'C-1', balance: '2500.00' })).toMatchObject(
      {
        type: 'DEBIT',
        amount: '2500.00',
      },
    );
  });
});
