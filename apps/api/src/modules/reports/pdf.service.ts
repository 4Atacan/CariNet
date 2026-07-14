import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { formatMoney, type MoneyString } from '@carinet/shared';
import { type StatementLine } from '../ledger/ledger.service';

/**
 * Ekstre PDF (§13 Faz 2) — pdfmake 0.3, sunucu tarafinda.
 * Roboto TTF'leri paketle gelir → dis font indirmesi YOK (kural #8).
 * §11.2 SSRF: urlAccessPolicy KAPALI (belge icinden dis kaynak cekilemez),
 * localAccessPolicy yalniz pdfmake'in kendi font klasorune izin verir.
 */
const req = createRequire(__filename);

interface TableCell {
  text: string;
  alignment?: 'left' | 'right' | 'center';
  bold?: boolean;
  fillColor?: string;
  fontSize?: number;
  color?: string;
}

interface PdfMake {
  addFonts(fonts: Record<string, Record<string, string>>): void;
  setUrlAccessPolicy(cb: (url: string) => boolean): void;
  setLocalAccessPolicy(cb: (path: string) => boolean): void;
  createPdf(doc: unknown): { getBuffer(): Promise<Buffer> };
}

export interface StatementPdfInput {
  sellerName: string;
  accountCode: string;
  title: string;
  balance: MoneyString;
  overdue: MoneyString;
  creditLimit: MoneyString;
  from?: Date;
  to?: Date;
  lines: StatementLine[];
}

@Injectable()
export class PdfService {
  private readonly pdfMake = createPdfMake();

  /** Ekstreyi PDF'e dokup Buffer dondurur (mobilde paylasilir, panelde indirilir). */
  async statement(input: StatementPdfInput): Promise<Buffer> {
    const body: TableCell[][] = [
      [
        head('Tarih'),
        head('Belge'),
        head('Aciklama'),
        head('Borc', 'right'),
        head('Alacak', 'right'),
        head('Bakiye', 'right'),
      ],
      ...input.lines.map((line) => [
        cell(trDate(line.documentDate)),
        cell(line.documentNo ?? line.documentType),
        cell(line.description ?? '—'),
        cell(line.type === 'DEBIT' ? formatMoney(line.amountTry) : '', 'right'),
        cell(line.type === 'CREDIT' ? formatMoney(line.amountTry) : '', 'right'),
        cell(formatMoney(line.runningBalance), 'right'),
      ]),
    ];

    const doc = {
      pageSize: 'A4',
      pageMargins: [32, 40, 32, 48],
      defaultStyle: { font: 'Roboto', fontSize: 9 },
      content: [
        { text: input.sellerName, fontSize: 14, bold: true },
        { text: 'Cari Hesap Ekstresi', fontSize: 11, margin: [0, 2, 0, 10] },
        {
          columns: [
            {
              text: [
                { text: 'Cari: ', bold: true },
                `${input.accountCode} · ${input.title}\n`,
                { text: 'Donem: ', bold: true },
                `${input.from ? trDate(input.from) : 'Basindan'} – ${
                  input.to ? trDate(input.to) : 'bugune'
                }`,
              ],
            },
            {
              alignment: 'right',
              text: [
                { text: 'Bakiye: ', bold: true },
                `${formatMoney(input.balance)}\n`,
                { text: 'Vadesi gecen: ', bold: true },
                `${formatMoney(input.overdue)}\n`,
                { text: 'Limit: ', bold: true },
                formatMoney(input.creditLimit),
              ],
            },
          ],
          margin: [0, 0, 0, 12],
        },
        {
          table: { headerRows: 1, widths: [55, 70, '*', 65, 65, 70], body },
          layout: 'lightHorizontalLines',
        },
        {
          text: 'Bakiye hareketlerden turetilmistir; pozitif bakiye alicinin borclu oldugunu gosterir.',
          fontSize: 7,
          color: '#64748b',
          margin: [0, 10, 0, 0],
        },
      ],
      footer: (page: number, total: number) => ({
        text: `${page} / ${total}`,
        alignment: 'center',
        fontSize: 8,
        color: '#94a3b8',
        margin: [0, 12, 0, 0],
      }),
    };

    return this.pdfMake.createPdf(doc).getBuffer();
  }
}

function createPdfMake(): PdfMake {
  const pdfMake = req('pdfmake') as PdfMake;
  const fontsRoot = join(dirname(req.resolve('pdfmake/package.json')), 'fonts', 'Roboto');
  const font = (file: string) => join(fontsRoot, file);

  pdfMake.addFonts({
    Roboto: {
      normal: font('Roboto-Regular.ttf'),
      bold: font('Roboto-Medium.ttf'),
      italics: font('Roboto-Italic.ttf'),
      bolditalics: font('Roboto-MediumItalic.ttf'),
    },
  });

  // §11.2: belge tanimindan dis kaynak CEKILEMEZ; yerel erisim yalniz font klasoru.
  pdfMake.setUrlAccessPolicy(() => false);
  pdfMake.setLocalAccessPolicy((path) => path.startsWith(fontsRoot));

  return pdfMake;
}

const head = (text: string, alignment: TableCell['alignment'] = 'left'): TableCell => ({
  text,
  alignment,
  bold: true,
  fillColor: '#f1f5f9',
  fontSize: 8,
});

const cell = (text: string, alignment: TableCell['alignment'] = 'left'): TableCell => ({
  text,
  alignment,
});

const trDate = (value: string | Date): string =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul' }).format(new Date(value));
