import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { type z } from 'zod';
import {
  AppError,
  DocumentType,
  ErrorCode,
  ImportSourceType,
  ImportTarget,
  TransactionType,
  buyerAccountRowSchema,
  computeBalance,
  openingBalanceRowSchema,
  paginate,
  sub,
  sum,
  transactionRowSchema,
  ublInvoiceSchema,
  type CommitImportInput,
  type ImportRowsQuery,
  type ImportUploadInput,
  type MoneyString,
  type PaginationQuery,
  type SaveTemplateInput,
  type UblInvoice,
} from '@carinet/shared';
import { AuditService } from '../../common/audit/audit.service';
import { Paginated } from '../../common/dto/paginated';
import { StorageService } from '../../common/storage/storage.service';
import { type RequestUser } from '../../common/types/request-with-user';
import { PRISMA, type PrismaService, type TxClient } from '../../prisma/prisma.module';
import { ExcelParser } from './parsers/excel.parser';
import { UblParser } from './parsers/ubl.parser';
import { ImportsRepository } from './imports.repository';

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface StagedRow {
  rowNo: number;
  raw: Prisma.InputJsonValue;
  parsed: Prisma.InputJsonValue | null;
  status: 'VALID' | 'ERROR';
  error: string | null;
}

const MAX_EXCEL_BYTES = 10 * 1024 * 1024; // §11.2

@Injectable()
export class ImportsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaService,
    private readonly repo: ImportsRepository,
    private readonly excel: ExcelParser,
    private readonly ubl: UblParser,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- 1) yukle → ayristir → staging

  /**
   * §6.6 hatti: yukle → ayristir → satir satir Zod → staging → onizleme + hata raporu.
   * Bu adim FINANSAL KAYIT YAZMAZ; yalniz import_batches / import_rows'a yazar.
   */
  async upload(file: UploadedFile, input: ImportUploadInput, user: RequestUser) {
    assertFile(file);

    const fileHash = this.storage.hash(file.buffer);
    const duplicate = await this.repo.findByHash(fileHash);

    const isUbl = input.target === ImportTarget.INVOICES;
    const staged = isUbl ? this.stageUbl(file) : await this.stageSpreadsheet(file, input);

    if (input.target === ImportTarget.OPENING_BALANCES && !input.cutoffDate) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Devir icin kesim tarihi zorunlu (§9)');
    }

    const fileUrl = await this.storage.archive(
      `imports/${user.sellerId}/${fileHash}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );

    const totals = summarize(staged.rows);
    const batch = await this.repo.createBatch({
      sourceType: isUbl ? ImportSourceType.UBL_XML : input.sourceType,
      target: input.target,
      fileName: file.originalname,
      fileUrl,
      fileHash,
      status: 'PARSED',
      mapping: {
        ...(staged.mapping ?? {}),
        ...(input.cutoffDate ? { __cutoffDate: input.cutoffDate.toISOString() } : {}),
      },
      totals,
      createdById: user.userId,
    });

    await this.repo.createRows(
      staged.rows.map((row) => ({
        batchId: batch.id,
        rowNo: row.rowNo,
        raw: row.raw,
        parsed: row.parsed ?? undefined,
        status: row.status,
        error: row.error,
      })),
    );

    await this.audit.log({
      action: 'IMPORT_STAGED',
      entity: 'ImportBatch',
      entityId: batch.id,
      after: { target: input.target, fileName: file.originalname, totals },
    });

    return {
      batchId: batch.id,
      target: input.target,
      mapping: staged.mapping,
      totals,
      /** Mukerrer dosya uyarisi — engel degil, uyari (§6.6). */
      duplicateOfBatchId: duplicate?.id ?? null,
      preview: staged.rows.slice(0, 20),
      errors: staged.rows.filter((r) => r.status === 'ERROR').slice(0, 50),
    };
  }

  private async stageSpreadsheet(file: UploadedFile, input: ImportUploadInput) {
    let mapping = input.mapping;
    if (input.templateId) {
      const template = await this.repo.findTemplate(input.templateId);
      if (!template) throw new AppError(ErrorCode.NOT_FOUND, 'Esleme sablonu bulunamadi');
      mapping = template.mapping as Record<string, string>;
    }

    const sheet = await this.excel.parse(file.buffer, input.target, mapping, input.sheetName);
    const schema = ROW_SCHEMA[input.target];
    if (!schema) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Bu hedef icin Excel importu desteklenmiyor');
    }

    const rows: StagedRow[] = sheet.rows.map((raw) => {
      const { __rowNo: rowNo, ...values } = raw as { __rowNo: number } & Record<string, unknown>;
      const result = schema.safeParse(values);
      return {
        rowNo,
        raw: values as Prisma.InputJsonValue,
        parsed: result.success ? (toJson(result.data) as Prisma.InputJsonValue) : null,
        status: result.success ? 'VALID' : 'ERROR',
        error: result.success ? null : formatIssues(result.error),
      };
    });

    return { rows, mapping: sheet.mapping as Record<string, string> };
  }

  /** UBL: her XML bir satirdir; cari eslesmesi VKN ile commit aninda yapilir (§9). */
  private stageUbl(file: UploadedFile) {
    const files = this.ubl.extractXmlFiles(file.buffer, file.originalname);

    const rows: StagedRow[] = files.map((entry, index) => {
      const rowNo = index + 1;
      try {
        const raw = this.ubl.parseInvoice(entry.xml);
        const result = ublInvoiceSchema.safeParse(raw);
        return {
          rowNo,
          raw: { fileName: entry.name } as Prisma.InputJsonValue,
          parsed: result.success ? (toJson(result.data) as Prisma.InputJsonValue) : null,
          status: result.success ? 'VALID' : 'ERROR',
          error: result.success ? null : formatIssues(result.error),
        };
      } catch (error) {
        return {
          rowNo,
          raw: { fileName: entry.name } as Prisma.InputJsonValue,
          parsed: null,
          status: 'ERROR' as const,
          error: error instanceof AppError ? error.message : 'XML ayristirilamadi',
        };
      }
    });

    return { rows, mapping: undefined };
  }

  // ---------------------------------------------------------------- 2) onizleme / rapor

  async listBatches(query: PaginationQuery) {
    const { skip, take } = paginate(query.page, query.limit);
    const { rows, total } = await this.repo.listBatches(skip, take);
    return Paginated.of(
      rows.map(({ _count, ...b }) => ({ ...b, rowCount: _count.rows })),
      query.page,
      query.limit,
      total,
    );
  }

  async batchRows(batchId: string, query: ImportRowsQuery) {
    await this.requireBatch(batchId);
    const { skip, take } = paginate(query.page, query.limit);
    const { rows, total } = await this.repo.listRows(batchId, query, skip, take);
    return Paginated.of(rows, query.page, query.limit, total);
  }

  /**
   * §9 Dogrulama Raporu: "program toplami ↔ bizim hesap, cari bazli fark listesi".
   * Fark kapanmadan go-live yok → commit bu raporu tekrar uretir ve uyusmazlikta reddeder.
   */
  async validationReport(batchId: string, expectedTotal?: MoneyString) {
    const batch = await this.requireBatch(batchId);

    return this.prisma.$transaction(async (tx) => {
      const rows = await this.repo.allRows(batchId, tx);
      const valid = rows.filter((r) => r.status === 'VALID' || r.status === 'COMMITTED');
      const accounts = await this.repo.accountsForMatching(tx);
      const byCode = new Map(accounts.map((a) => [a.accountCode, a]));

      const lines = valid.map((row) => {
        const parsed = row.parsed as { accountCode: string; type: string; amount: string };
        const existing = byCode.get(parsed.accountCode);
        return {
          rowNo: row.rowNo,
          accountCode: parsed.accountCode,
          exists: Boolean(existing),
          type: parsed.type,
          amount: parsed.amount,
        };
      });

      const importedTotal = computeBalance(
        lines.map((l) => ({ type: l.type as TransactionType, amount: l.amount })),
      );
      const difference = expectedTotal ? sub(expectedTotal, importedTotal) : null;

      return {
        batchId,
        target: batch.target,
        rowCount: rows.length,
        validCount: valid.length,
        errorCount: rows.filter((r) => r.status === 'ERROR').length,
        newAccounts: lines.filter((l) => !l.exists).length,
        existingAccounts: lines.filter((l) => l.exists).length,
        /** Net devir (borc − alacak). */
        importedTotal,
        expectedTotal: expectedTotal ?? null,
        difference,
        /** Fark sifir degilse commit REDDEDILIR. */
        matches: difference === null || difference === '0.00',
        lines: lines.slice(0, 200),
      };
    });
  }

  // ---------------------------------------------------------------- 3) onay → TEK transaction commit

  async commit(batchId: string, input: CommitImportInput, user: RequestUser) {
    const batch = await this.requireBatch(batchId);
    if (batch.status !== 'PARSED') {
      throw new AppError(ErrorCode.CONFLICT, 'Bu yukleme zaten islenmis veya iptal edilmis');
    }

    if (input.expectedTotal) {
      const report = await this.validationReport(batchId, input.expectedTotal);
      if (!report.matches) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Dogrulama raporunda fark var — commit yok',
          {
            expectedTotal: report.expectedTotal,
            importedTotal: report.importedTotal,
            difference: report.difference,
          },
        );
      }
    }

    const totals = await this.prisma.$transaction(async (tx) => {
      const rows = await this.repo.allRows(batchId, tx);
      const errorCount = rows.filter((r) => r.status === 'ERROR').length;
      if (errorCount > 0 && !input.skipErrorRows) {
        throw new AppError(ErrorCode.IMPORT_ROW_ERRORS, undefined, { errorCount });
      }

      const valid = rows.filter((r) => r.status === 'VALID');
      if (valid.length === 0) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Islenecek gecerli satir yok');
      }

      const cutoffDate = readCutoff(batch.mapping);
      if (batch.target === ImportTarget.OPENING_BALANCES && !cutoffDate) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Kesim tarihi bulunamadi');
      }
      const written = await this.writeRows(batch.target, valid, batchId, cutoffDate, user, tx);

      await this.repo.markRowsCommitted(batchId, tx);
      const summary = { ...(batch.totals as object), ...written, errorCount };
      await this.repo.updateBatch(batchId, { status: 'COMMITTED', totals: summary }, tx);
      await this.audit.log(
        { action: 'IMPORT_COMMITTED', entity: 'ImportBatch', entityId: batchId, after: summary },
        tx,
      );
      return summary;
    });

    return { batchId, status: 'COMMITTED', totals };
  }

  /** Hedefe gore yazim. Tumu ayni DB transaction'i icinde — ya hepsi ya hicbiri (§6.6). */
  private async writeRows(
    target: string,
    rows: { rowNo: number; parsed: unknown }[],
    batchId: string,
    cutoffDate: Date | undefined,
    user: RequestUser,
    tx: TxClient,
  ): Promise<Record<string, number>> {
    const accounts = await this.repo.accountsForMatching(tx);
    const byCode = new Map(accounts.map((a) => [a.accountCode, a]));
    const byVkn = new Map(accounts.filter((a) => a.vknTckn).map((a) => [a.vknTckn!, a]));

    if (target === ImportTarget.BUYER_ACCOUNTS) {
      let created = 0;
      let skipped = 0;
      for (const row of rows) {
        const data = row.parsed as {
          accountCode: string;
          title: string;
          vknTckn?: string;
          creditLimit?: string;
        };
        if (byCode.has(data.accountCode)) {
          skipped += 1; // mevcut cari EZILMEZ (kural #4 ruhu) — panelden guncellenir
          continue;
        }
        const account = await this.repo.createAccount(
          {
            accountCode: data.accountCode,
            title: data.title,
            vknTckn: data.vknTckn,
            creditLimit: data.creditLimit ?? '0',
          },
          tx,
        );
        byCode.set(account.accountCode, {
          id: account.id,
          accountCode: account.accountCode,
          vknTckn: account.vknTckn,
          isActive: account.isActive,
        });
        created += 1;
      }
      return { createdAccounts: created, skippedAccounts: skipped };
    }

    if (target === ImportTarget.TRANSACTIONS || target === ImportTarget.OPENING_BALANCES) {
      const isOpening = target === ImportTarget.OPENING_BALANCES;
      const data: Omit<Prisma.TransactionUncheckedCreateInput, 'sellerId'>[] = [];
      let createdAccounts = 0;

      // Devirde ayni cariye ikinci kez devir girilemez (§9).
      if (isOpening) {
        const ids = rows
          .map((r) => byCode.get((r.parsed as { accountCode: string }).accountCode)?.id)
          .filter((id): id is string => Boolean(id));
        const existing = await this.repo.existingOpeningBalances(ids, tx);
        if (existing.length > 0) {
          throw new AppError(
            ErrorCode.CONFLICT,
            'Bazi carilerde devir kaydi zaten var — once mevcut deviri iptal edin',
            { count: existing.length },
          );
        }
      }

      for (const row of rows) {
        const parsed = row.parsed as {
          accountCode: string;
          title?: string;
          vknTckn?: string;
          type: TransactionType;
          amount: string;
          documentDate?: string;
          dueDate?: string;
          documentNo?: string;
          documentType?: DocumentType;
          description?: string;
          currencyCode?: string;
          exchangeRate?: string;
        };

        let account = byCode.get(parsed.accountCode);
        if (!account) {
          if (!isOpening) {
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              `Satir ${row.rowNo}: cari kodu bulunamadi (${parsed.accountCode})`,
            );
          }
          // Devir sihirbazi: cari yoksa olusturulur (§9 — cari listesi + devir tek akista).
          const created = await this.repo.createAccount(
            {
              accountCode: parsed.accountCode,
              title: parsed.title ?? parsed.accountCode,
              vknTckn: parsed.vknTckn,
            },
            tx,
          );
          account = {
            id: created.id,
            accountCode: created.accountCode,
            vknTckn: created.vknTckn,
            isActive: created.isActive,
          };
          byCode.set(created.accountCode, account);
          createdAccounts += 1;
        }

        data.push({
          buyerAccountId: account.id,
          type: parsed.type,
          documentType: isOpening
            ? DocumentType.OPENING_BALANCE
            : (parsed.documentType ?? DocumentType.OTHER),
          documentNo: parsed.documentNo,
          documentDate: isOpening ? cutoffDate! : new Date(parsed.documentDate!),
          dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
          amount: parsed.amount,
          currencyCode: parsed.currencyCode ?? 'TRY',
          exchangeRate: parsed.exchangeRate ?? '1',
          description: isOpening
            ? 'Devir bakiyesi (gecis sihirbazi)'
            : (parsed.description ?? undefined),
          importBatchId: batchId,
          createdById: user.userId,
        });
      }

      await this.repo.createTransactions(data, tx);
      return { createdTransactions: data.length, createdAccounts };
    }

    if (target === ImportTarget.INVOICES) {
      const invoices = rows.map((r) => r.parsed as UblInvoice);
      const existing = await this.repo.existingInvoiceNos(
        invoices.map((i) => i.invoiceNo),
        tx,
      );
      const known = new Set(existing.map((e) => e.invoiceNo));

      let created = 0;
      let skipped = 0;
      for (const invoice of invoices) {
        if (known.has(invoice.invoiceNo)) {
          skipped += 1; // mukerrer fatura — sessizce atlanir, raporda gorunur
          continue;
        }
        const account = byVkn.get(invoice.buyerVkn);
        if (!account) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            `Fatura ${invoice.invoiceNo}: VKN ${invoice.buyerVkn} ile eslesen cari yok`,
          );
        }

        const row = await this.repo.createInvoice(
          {
            buyerAccountId: account.id,
            invoiceNo: invoice.invoiceNo,
            invoiceDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
            currencyCode: invoice.currencyCode,
            exchangeRate: invoice.exchangeRate,
            netTotal: invoice.netTotal,
            taxTotal: invoice.taxTotal,
            grandTotal: invoice.grandTotal,
            ublUuid: invoice.ublUuid,
            items: {
              create: invoice.items.map((item, index) => ({
                lineNo: index + 1,
                name: item.name,
                unit: item.unit,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate: item.taxRate,
                netTotal: item.netTotal,
                taxAmount: item.taxAmount,
                lineTotal: item.lineTotal,
                exchangeRate: invoice.exchangeRate,
              })),
            },
          },
          tx,
        );

        await this.repo.createTransactions(
          [
            {
              buyerAccountId: account.id,
              type: TransactionType.DEBIT,
              documentType: DocumentType.SALES_INVOICE,
              documentNo: invoice.invoiceNo,
              documentDate: invoice.invoiceDate,
              dueDate: invoice.dueDate,
              amount: invoice.grandTotal,
              currencyCode: invoice.currencyCode,
              exchangeRate: invoice.exchangeRate,
              description: 'e-Fatura (UBL)',
              invoiceId: row.id,
              importBatchId: batchId,
              createdById: user.userId,
            },
          ],
          tx,
        );
        created += 1;
      }
      return { createdInvoices: created, skippedInvoices: skipped };
    }

    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Desteklenmeyen import hedefi');
  }

  // ---------------------------------------------------------------- 4) iptal

  /** §6.6 — batch iptali: bagli finansal kayitlara toplu is_cancelled + audit (silme YOK). */
  async cancel(batchId: string, reason: string, user: RequestUser) {
    const batch = await this.requireBatch(batchId);
    if (batch.status === 'CANCELLED') {
      throw new AppError(ErrorCode.CONFLICT, 'Bu yukleme zaten iptal edilmis');
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const result =
        batch.status === 'COMMITTED'
          ? await this.repo.cancelBatchTransactions(batchId, tx)
          : { count: 0 };

      await this.repo.updateBatch(batchId, { status: 'CANCELLED' }, tx);
      await this.audit.log(
        {
          action: 'IMPORT_CANCELLED',
          entity: 'ImportBatch',
          entityId: batchId,
          before: { status: batch.status },
          after: { status: 'CANCELLED', reason, cancelledTransactions: result.count },
          actorUserId: user.userId,
        },
        tx,
      );
      return result.count;
    });

    return { batchId, status: 'CANCELLED', cancelledTransactions: cancelled };
  }

  // ---------------------------------------------------------------- sablonlar (§9)

  listTemplates() {
    return this.repo.listTemplates();
  }

  async saveTemplate(input: SaveTemplateInput) {
    return this.repo.createTemplate(input);
  }

  private async requireBatch(id: string) {
    const batch = await this.repo.findBatch(id);
    if (!batch) throw new AppError(ErrorCode.NOT_FOUND, 'Yukleme bulunamadi');
    return batch;
  }
}

/** Hedef → satir semasi (kural #7: her satir sinirdan gecerken Zod'dan gecer). */
const ROW_SCHEMA: Partial<Record<string, z.ZodTypeAny>> = {
  [ImportTarget.BUYER_ACCOUNTS]: buyerAccountRowSchema,
  [ImportTarget.TRANSACTIONS]: transactionRowSchema,
  [ImportTarget.OPENING_BALANCES]: openingBalanceRowSchema,
};

function assertFile(file: UploadedFile | undefined): asserts file is UploadedFile {
  if (!file) throw new AppError(ErrorCode.VALIDATION_ERROR, 'Dosya yuklenmedi');
  if (file.size > MAX_EXCEL_BYTES) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Dosya 10 MB sinirini asiyor');
  }
}

function summarize(rows: StagedRow[]) {
  const valid = rows.filter((r) => r.status === 'VALID');
  const amounts = valid
    .map((r) => r.parsed as { type?: TransactionType; amount?: MoneyString } | null)
    .filter((p): p is { type: TransactionType; amount: MoneyString } =>
      Boolean(p?.amount && p.type),
    );

  return {
    rowCount: rows.length,
    validCount: valid.length,
    errorCount: rows.length - valid.length,
    totalDebit: sum(amounts.filter((a) => a.type === TransactionType.DEBIT).map((a) => a.amount)),
    totalCredit: sum(amounts.filter((a) => a.type === TransactionType.CREDIT).map((a) => a.amount)),
    net: computeBalance(amounts),
  };
}

/** Zod hatalarini "satir no + sebep" bicimine indirger (§6.6 hata raporu). */
function formatIssues(error: { issues: { path: (string | number)[]; message: string }[] }): string {
  return error.issues
    .map((i) => (i.path.length > 0 ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join(' · ');
}

/** Date → ISO; Prisma Json kolonuna guvenli yazim. */
function toJson(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v: unknown) => (v instanceof Date ? v.toISOString() : v)),
  );
}

function readCutoff(mapping: unknown): Date | undefined {
  if (typeof mapping !== 'object' || mapping === null) return undefined;
  const raw = (mapping as Record<string, unknown>).__cutoffDate;
  return typeof raw === 'string' ? new Date(raw) : undefined;
}
