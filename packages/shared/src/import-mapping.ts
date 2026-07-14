import { ImportTarget } from './enums';

/**
 * §9 — Excel kolon eslemesi. Muhasebe programlarinin (Logo/Mikro/Netsis/ETA) disa aktarimlari
 * ayni anlami farkli basliklarla tasir. Once takma adlardan OTOMATIK eslesme denenir,
 * kullanici duzeltir, onaylanan esleme sablon olarak saklanir (import_templates).
 */

/** Basligi karsilastirilabilir hale getirir: kucuk harf, Turkce karakter sadelestirme, sembol atma. */
export function normalizeHeader(raw: string): string {
  return raw
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replace(/[^a-z0-9]/g, '');
}

/** Kanonik alan adlari — satir semalarinin bekledigi anahtarlar. */
export const IMPORT_FIELDS = {
  accountCode: ['carikodu', 'carikod', 'hesapkodu', 'musterikodu', 'kod', 'accountcode', 'code'],
  title: ['unvan', 'cariunvani', 'cariadi', 'musteriadi', 'adsoyad', 'title', 'name'],
  vknTckn: ['vkn', 'tckn', 'vknTckn', 'vknktckn', 'verginumarasi', 'vergino', 'tckimlikno'],
  creditLimit: ['risklimiti', 'kredilimiti', 'limit', 'creditlimit'],
  representative: ['temsilci', 'satistemsilcisi', 'plasiyer'],
  documentDate: ['tarih', 'belgetarihi', 'fistarihi', 'islemtarihi', 'valortarihi', 'date'],
  dueDate: ['vade', 'vadetarihi', 'duedate'],
  documentNo: ['belgeno', 'faturano', 'evrakno', 'fisno', 'documentno'],
  documentType: ['belgeturu', 'evrakturu', 'tur', 'documenttype'],
  debit: ['borc', 'cikan', 'debit'],
  credit: ['alacak', 'giren', 'credit'],
  amount: ['tutar', 'islemtutari', 'tutartl', 'amount'],
  type: ['hareketturu', 'islemturu', 'type'],
  description: ['aciklama', 'islemaciklamasi', 'detay', 'description'],
  currencyCode: ['parabirimi', 'doviz', 'dovizcinsi', 'currency'],
  exchangeRate: ['kur', 'dovizkuru', 'rate'],
  balance: ['bakiye', 'devir', 'devirbakiyesi', 'acilisbakiyesi', 'balance'],
} as const;

export type ImportField = keyof typeof IMPORT_FIELDS;

/** Hedef basina zorunlu alanlar — biri bulunamazsa esleme eksik sayilir. */
export const REQUIRED_FIELDS: Record<ImportTarget, readonly ImportField[]> = {
  [ImportTarget.BUYER_ACCOUNTS]: ['accountCode', 'title'],
  [ImportTarget.TRANSACTIONS]: ['accountCode', 'documentDate'],
  [ImportTarget.OPENING_BALANCES]: ['accountCode'],
  [ImportTarget.INVOICES]: [],
  /** Banka ekstresi (§8 Kanal 1): tarih + aciklama zorunlu; tutar hasAmountField ile aranir. */
  [ImportTarget.BANK_STATEMENT]: ['documentDate', 'description'],
};

/** Hedefte anlamli olan tum alanlar (fazlasi gormezden gelinir). */
export const TARGET_FIELDS: Record<ImportTarget, readonly ImportField[]> = {
  [ImportTarget.BUYER_ACCOUNTS]: [
    'accountCode',
    'title',
    'vknTckn',
    'creditLimit',
    'representative',
  ],
  [ImportTarget.TRANSACTIONS]: [
    'accountCode',
    'documentDate',
    'dueDate',
    'documentNo',
    'documentType',
    'debit',
    'credit',
    'amount',
    'type',
    'description',
    'currencyCode',
    'exchangeRate',
  ],
  [ImportTarget.OPENING_BALANCES]: [
    'accountCode',
    'title',
    'vknTckn',
    'balance',
    'debit',
    'credit',
  ],
  [ImportTarget.INVOICES]: [],
  [ImportTarget.BANK_STATEMENT]: ['documentDate', 'description', 'amount', 'debit', 'credit'],
};

/** Kolon eslemesi: kanonik alan → dosyadaki baslik. */
export type ColumnMapping = Partial<Record<ImportField, string>>;

/**
 * Basliklardan otomatik esleme onerisi uretir. Bulunamayan alan mapping'e KONULMAZ;
 * eksik zorunlu alanlar `missing` ile bildirilir → panel kullaniciya sorar.
 */
export function autoMap(
  headers: readonly string[],
  target: ImportTarget,
): { mapping: ColumnMapping; missing: ImportField[] } {
  const normalized = headers.map((h) => ({ raw: h, key: normalizeHeader(h) }));
  const mapping: ColumnMapping = {};

  for (const field of TARGET_FIELDS[target]) {
    const aliases: readonly string[] = IMPORT_FIELDS[field];
    const hit = normalized.find((h) => aliases.includes(h.key));
    if (hit) mapping[field] = hit.raw;
  }

  const missing = REQUIRED_FIELDS[target].filter((f) => !mapping[f]);
  return { mapping, missing };
}

/** Tutar alani hic yoksa satir anlamsizdir (hareket/devir icin). */
export function hasAmountField(mapping: ColumnMapping, target: ImportTarget): boolean {
  if (target === ImportTarget.TRANSACTIONS) {
    return Boolean(mapping.amount ?? mapping.debit ?? mapping.credit);
  }
  if (target === ImportTarget.OPENING_BALANCES) {
    return Boolean(mapping.balance ?? mapping.debit ?? mapping.credit);
  }
  if (target === ImportTarget.BANK_STATEMENT) {
    // Ekstrede gelen para "tutar" veya "alacak" kolonundadir; yalniz "borc" varsa cikis hareketidir.
    return Boolean(mapping.amount ?? mapping.credit);
  }
  return true;
}
