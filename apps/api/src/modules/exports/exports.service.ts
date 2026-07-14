import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  AppError,
  ErrorCode,
  UserRole,
  neutralizeFormula,
  type ExportQuery,
} from '@carinet/shared';
import { type RequestUser } from '../../common/types/request-with-user';
import { BuyersService } from '../buyers/buyers.service';
import { LedgerService } from '../ledger/ledger.service';
import { ProductsService } from '../products/products.service';
import { ReportsService } from '../reports/reports.service';

/**
 * §13 Faz 4 — Excel disa aktarma.
 *
 * §11.3 CSV INJECTION: disa aktarilan dosyayi kullanici Excel'de acar. "=", "+", "-", "@"
 * ile baslayan bir hucre FORMUL olarak calisir — cari unvanina `=cmd|...` yazan biri,
 * dosyayi acan muhasebecinin makinesinde komut calistirabilir. Bu yuzden METIN hucreleri
 * neutralizeFormula'dan gecer (basina tirnak konur). Sayisal hucreler etkilenmez.
 */
@Injectable()
export class ExportsService {
  constructor(
    private readonly buyers: BuyersService,
    private readonly ledger: LedgerService,
    private readonly products: ProductsService,
    private readonly reports: ReportsService,
  ) {}

  async build(
    query: ExportQuery,
    user: RequestUser,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    // §11.2 IDOR — cari LISTESI satici verisidir: bir alici, saticinin diger musterilerini
    // (unvan, bakiye, limit) indiremez. Ekstre/urun/risk kendi baglamina zaten kisitli.
    if (query.target === 'BUYERS' && user.role === UserRole.BUYER_USER) {
      throw new AppError(ErrorCode.FORBIDDEN);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CariNet';
    workbook.created = new Date();

    switch (query.target) {
      case 'BUYERS':
        await this.buyersSheet(workbook);
        break;
      case 'TRANSACTIONS':
        await this.transactionsSheet(workbook, query, user);
        break;
      case 'PRODUCTS':
        await this.productsSheet(workbook, user);
        break;
      case 'RISK':
        await this.riskSheet(workbook, user);
        break;
      default:
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Desteklenmeyen disa aktarma hedefi');
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { buffer, fileName: FILE_NAMES[query.target] };
  }

  /** Cari listesi zaten tenant filtreli (kural #3); ek kullanici kapisi gerekmez. */
  private async buyersSheet(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet('Cari Hesaplar');
    sheet.columns = [
      { header: 'Cari Kodu', key: 'code', width: 18 },
      { header: 'Unvan', key: 'title', width: 40 },
      { header: 'VKN/TCKN', key: 'vkn', width: 16 },
      { header: 'Kredi Limiti', key: 'limit', width: 16 },
      { header: 'Bakiye', key: 'balance', width: 16 },
      { header: 'Temsilci', key: 'rep', width: 24 },
      { header: 'Durum', key: 'status', width: 10 },
    ];

    const { data } = await this.buyers.list({ page: 1, limit: 100 });
    for (const buyer of data) {
      sheet.addRow({
        code: text(buyer.accountCode),
        title: text(buyer.title),
        vkn: text(buyer.vknTckn ?? ''),
        limit: money(buyer.creditLimit),
        balance: money(buyer.balance.balance),
        rep: text(buyer.representative?.fullName ?? ''),
        status: buyer.isActive ? 'Aktif' : 'Pasif',
      });
    }
    styleHeader(sheet);
  }

  private async transactionsSheet(
    workbook: ExcelJS.Workbook,
    query: ExportQuery,
    user: RequestUser,
  ) {
    if (!query.buyerAccountId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Hareket disa aktarimi icin cari secilmeli');
    }

    const sheet = workbook.addWorksheet('Ekstre');
    sheet.columns = [
      { header: 'Tarih', key: 'date', width: 12 },
      { header: 'Vade', key: 'due', width: 12 },
      { header: 'Belge Turu', key: 'type', width: 18 },
      { header: 'Belge No', key: 'no', width: 18 },
      { header: 'Aciklama', key: 'desc', width: 40 },
      { header: 'Borc', key: 'debit', width: 14 },
      { header: 'Alacak', key: 'credit', width: 14 },
      { header: 'Yuruyen Bakiye', key: 'running', width: 16 },
    ];

    // Erisim kontrolu: BUYER_USER kendi carisi disina cikamaz (§11.2 IDOR).
    // buyers.statement bu kontrolu yapar; ciktisini kullanmayiz, KAPI gorevi gorur.
    await this.buyers.statement(query.buyerAccountId, user, {
      page: 1,
      limit: 1,
      from: query.from,
      to: query.to,
    });

    const { rows } = await this.ledger.statement(query.buyerAccountId, {
      from: query.from,
      to: query.to,
      skip: 0,
      take: 5000, // disa aktarma icin makul ust sinir
    });

    // Ekstre eskiden yeniye okunur.
    for (const line of rows.slice().reverse()) {
      sheet.addRow({
        date: line.documentDate,
        due: line.dueDate ?? '',
        type: text(line.documentType),
        no: text(line.documentNo ?? ''),
        desc: text(line.description ?? ''),
        debit: line.type === 'DEBIT' ? money(line.amountTry) : null,
        credit: line.type === 'CREDIT' ? money(line.amountTry) : null,
        running: money(line.runningBalance),
      });
    }
    styleHeader(sheet);
  }

  private async productsSheet(workbook: ExcelJS.Workbook, user: RequestUser) {
    const sheet = workbook.addWorksheet('Urunler');
    sheet.columns = [
      { header: 'Urun Kodu', key: 'code', width: 18 },
      { header: 'Ad', key: 'name', width: 40 },
      { header: 'Birim', key: 'unit', width: 10 },
      { header: 'Fiyat', key: 'price', width: 14 },
      { header: 'Stok', key: 'qty', width: 14 },
      { header: 'Durum', key: 'status', width: 10 },
    ];

    const { data } = await this.products.list({ page: 1, limit: 100 }, user);
    for (const product of data) {
      sheet.addRow({
        code: text(product.code),
        name: text(product.name),
        unit: text(product.unit),
        price: product.price ? money(product.price) : null,
        qty: Number(product.quantity),
        status: product.isActive ? 'Aktif' : 'Pasif',
      });
    }
    styleHeader(sheet);
  }

  private async riskSheet(workbook: ExcelJS.Workbook, user: RequestUser) {
    const sheet = workbook.addWorksheet('Risk Foyu');
    sheet.columns = [
      { header: 'Cari Kodu', key: 'code', width: 18 },
      { header: 'Unvan', key: 'title', width: 36 },
      { header: 'Bakiye', key: 'balance', width: 14 },
      { header: 'Vadesi Gecen', key: 'overdue', width: 14 },
      { header: '0-30', key: 'b1', width: 12 },
      { header: '31-60', key: 'b2', width: 12 },
      { header: '61-90', key: 'b3', width: 12 },
      { header: '90+', key: 'b4', width: 12 },
      { header: 'Limit %', key: 'limit', width: 10 },
    ];

    const rows = await this.reports.risk(user);
    for (const row of rows) {
      sheet.addRow({
        code: text(row.accountCode),
        title: text(row.title),
        balance: money(row.balance),
        overdue: money(row.overdue),
        b1: money(row.buckets.D0_30),
        b2: money(row.buckets.D31_60),
        b3: money(row.buckets.D61_90),
        b4: money(row.buckets.D90_PLUS),
        limit: row.limitUsagePercent,
      });
    }
    styleHeader(sheet);
  }
}

const FILE_NAMES: Record<ExportQuery['target'], string> = {
  BUYERS: 'cari-hesaplar.xlsx',
  TRANSACTIONS: 'ekstre.xlsx',
  PRODUCTS: 'urunler.xlsx',
  RISK: 'risk-foyu.xlsx',
};

/** §11.3 — metin hucreleri formul olarak calismasin (CSV/Excel injection). */
const text = (value: string): string => neutralizeFormula(value);

/**
 * Para SAYI olarak yazilir (Excel'de toplanabilsin) ama JS number'a cevrilirken
 * hassasiyet kaybi olmasin diye tutar zaten 2 ondaliklidir — hesap YAPILMAZ, sadece gosterilir.
 * Uygulama ici tum aritmetik decimal.js iledir (kural #1).
 */
const money = (value: string): number => Number(value);

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}
