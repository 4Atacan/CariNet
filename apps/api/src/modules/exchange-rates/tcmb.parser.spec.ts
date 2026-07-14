import { describe, expect, it } from 'vitest';
import { TcmbParser } from './tcmb.parser';

/** TCMB'nin gercek yanit bicimi (kisaltilmis). JPY 100 birim uzerinden kote edilir. */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="14.07.2026" Date="07/14/2026" Bulten_No="2026/133">
  <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
    <Unit>1</Unit>
    <Isim>ABD DOLARI</Isim>
    <ForexBuying>38,3910</ForexBuying>
    <ForexSelling>38,4210</ForexSelling>
  </Currency>
  <Currency CrossOrder="1" Kod="EUR" CurrencyCode="EUR">
    <Unit>1</Unit>
    <Isim>EURO</Isim>
    <ForexBuying>41,1200</ForexBuying>
    <ForexSelling>41,2000</ForexSelling>
  </Currency>
  <Currency CrossOrder="8" Kod="JPY" CurrencyCode="JPY">
    <Unit>100</Unit>
    <Isim>JAPON YENI</Isim>
    <ForexBuying>25,8000</ForexBuying>
    <ForexSelling>26,0000</ForexSelling>
  </Currency>
  <Currency CrossOrder="9" Kod="KWD" CurrencyCode="KWD">
    <Unit>1</Unit>
    <Isim>KUVEYT DINARI</Isim>
    <ForexSelling>125,0000</ForexSelling>
  </Currency>
</Tarih_Date>`;

describe('TcmbParser', () => {
  const parser = new TcmbParser();

  it('doviz SATIS kurunu okur ve virgulu noktaya cevirir', () => {
    const rates = parser.parse(XML);
    const usd = rates.find((r) => r.currencyCode === 'USD');
    expect(usd?.rate).toBe('38.4210');
  });

  it('4 ondalikli kur olcegini korur (kural #1)', () => {
    const eur = parser.parse(XML).find((r) => r.currencyCode === 'EUR');
    expect(eur?.rate).toBe('41.2000');
  });

  it('100 birim uzerinden kote edilen JPY"yi BIRIM BASINA indirger', () => {
    const jpy = parser.parse(XML).find((r) => r.currencyCode === 'JPY');
    // 26,0000 / 100 = 0,26
    expect(jpy?.rate).toBe('0.2600');
  });

  it('izlenmeyen para birimlerini atlar (KWD)', () => {
    const codes = parser.parse(XML).map((r) => r.currencyCode);
    expect(codes).not.toContain('KWD');
    expect(codes).toEqual(expect.arrayContaining(['USD', 'EUR', 'JPY']));
  });

  it('TCMB tarihini (gg.aa.yyyy) dogru okur', () => {
    const [first] = parser.parse(XML);
    expect(first?.date.toISOString().slice(0, 10)).toBe('2026-07-14');
  });

  it('taninmayan govdeyi reddeder (dis sinir — kural #7)', () => {
    expect(() => parser.parse('<html>hata</html>')).toThrow();
    expect(() => parser.parse('<Tarih_Date Tarih="14.07.2026"></Tarih_Date>')).toThrow();
  });
});
