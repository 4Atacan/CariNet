import { Readable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  AppError,
  ErrorCode,
  type CellValue,
  type ColumnMapping,
  type ImportField,
  type ImportTarget,
  autoMap,
  cellToDate,
  cellToMoney,
  cellToRate,
  cellToText,
  hasAmountField,
} from '@carinet/shared';

export interface ParsedSheet {
  headers: string[];
  /** Kanonik alan → ham hucre degeri. Zod dogrulamasi servis katmaninda yapilir. */
  rows: Record<string, unknown>[];
  mapping: ColumnMapping;
  missing: ImportField[];
}

/** Hangi alanin hangi normalize ediciden gecirilecegi (§11.3: Zod'dan ONCE sadelestir). */
const CELL_READERS: Record<ImportField, (v: CellValue) => unknown> = {
  accountCode: cellToText,
  title: cellToText,
  vknTckn: cellToText,
  creditLimit: cellToMoney,
  representative: cellToText,
  documentDate: cellToDate,
  dueDate: cellToDate,
  documentNo: cellToText,
  documentType: cellToText,
  debit: cellToMoney,
  credit: cellToMoney,
  amount: cellToMoney,
  type: cellToText,
  description: cellToText,
  currencyCode: (v) => cellToText(v)?.toUpperCase(),
  exchangeRate: cellToRate,
  balance: cellToMoney,
};

@Injectable()
export class ExcelParser {
  /**
   * Yukle → ayristir → kanonik satirlar (§6.6 hattinin ilk adimi).
   * Hicbir yazma yapmaz; ciktisi staging'e (import_rows) gider.
   */
  async parse(
    buffer: Buffer,
    target: ImportTarget,
    overrideMapping?: ColumnMapping,
    sheetName?: string,
  ): Promise<ParsedSheet> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const sheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];
    if (!sheet) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Dosyada okunabilir sayfa bulunamadi');
    }
    return this.extract(sheet, target, overrideMapping);
  }

  /**
   * Banka ekstreleri cogunlukla CSV iner (§8 Kanal 1). Ayirici bankaya gore degisir:
   * TR bankalari genelde ";" kullanir (ondalik virgul yuzunden), bazilari "," veya TAB.
   */
  async parseCsv(
    buffer: Buffer,
    target: ImportTarget,
    overrideMapping?: ColumnMapping,
  ): Promise<ParsedSheet> {
    const workbook = new ExcelJS.Workbook();
    const sheet = await workbook.csv.read(Readable.from(buffer), {
      parserOptions: { delimiter: detectDelimiter(buffer) },
    });
    if (!sheet) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'CSV okunamadi');
    }
    return this.extract(sheet, target, overrideMapping);
  }

  private extract(
    sheet: ExcelJS.Worksheet,
    target: ImportTarget,
    overrideMapping?: ColumnMapping,
  ): ParsedSheet {
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
      headers[col - 1] = String(cell.value ?? '').trim();
    });
    if (headers.filter(Boolean).length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Dosyanin ilk satirinda baslik bulunamadi');
    }

    const auto = autoMap(headers, target);
    const mapping: ColumnMapping = { ...auto.mapping, ...overrideMapping };
    const missing = auto.missing.filter((f) => !mapping[f]);

    if (missing.length > 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Zorunlu kolonlar eslenemedi', {
        missing,
        headers,
        suggested: auto.mapping,
      });
    }
    if (!hasAmountField(mapping, target)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Tutar kolonu bulunamadi (borc/alacak, tutar veya bakiye)',
        { headers, suggested: auto.mapping },
      );
    }

    // Baslik adi → kolon indeksi (1 tabanli, ExcelJS).
    const columnOf = new Map<string, number>();
    headers.forEach((h, i) => {
      if (h) columnOf.set(h, i + 1);
    });

    const rows: Record<string, unknown>[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;

      const parsed: Record<string, unknown> = {};
      let hasValue = false;

      for (const [field, header] of Object.entries(mapping) as [ImportField, string][]) {
        const col = columnOf.get(header);
        if (!col) continue;

        const raw = toCellValue(row.getCell(col).value);
        const value = CELL_READERS[field](raw);
        if (value !== undefined) {
          parsed[field] = value;
          hasValue = true;
        }
      }

      if (hasValue) rows.push({ ...parsed, __rowNo: rowNumber });
    });

    if (rows.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Dosyada veri satiri yok');
    }
    return { headers, rows, mapping, missing: [] };
  }
}

/** Baslik satirindaki ayirici adaylarindan en cok geceni secer. */
function detectDelimiter(buffer: Buffer): string {
  const firstLine = buffer.toString('utf8').split(/\r?\n/)[0] ?? '';
  const candidates = [';', ',', '\t'];
  return candidates.reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best,
  );
}

/** ExcelJS hucre degerleri zengin tiplerdir (formul/hyperlink/rich text) → sade degere indir. */
function toCellValue(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('result' in value) return toCellValue(value.result as ExcelJS.CellValue); // formul sonucu
    if ('text' in value) return String(value.text); // hyperlink / rich text
    if ('richText' in value) return value.richText.map((t) => t.text).join('');
    return undefined;
  }
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  return undefined;
}
