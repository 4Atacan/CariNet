import { Injectable, Logger } from '@nestjs/common';
import {
  AppError,
  ErrorCode,
  ImportSourceType,
  ImportTarget,
  bankStatementRowSchema,
  gt,
  matchStatementRows,
  sum,
  toMoney,
  type AccountCodeRef,
  type BulkConfirmInput,
  type MoneyString,
  type StatementMatch,
} from '@carinet/shared';
import { AuditService } from '../../common/audit/audit.service';
import { StorageService } from '../../common/storage/storage.service';
import { type RequestUser } from '../../common/types/request-with-user';
import { ExcelParser } from '../imports/parsers/excel.parser';
import { type UploadedFile } from '../imports/imports.service';
import { CollectionsRepository } from './collections.repository';
import { IntentFactory } from './intent-factory.service';
import { BankTransferProvider } from './providers/bank-transfer.provider';

const MAX_STATEMENT_BYTES = 10 * 1024 * 1024; // §11.2

export interface StatementRowView {
  id: string;
  rowNo: number;
  txDate: string;
  description: string;
  amount: MoneyString;
  matchedIntentId: string | null;
}

/**
 * §8 Kanal 1'in panel tarafi: internet bankaciligi ekstresi (CSV/Excel) →
 * otomatik eslestirme onerisi → insan onayi → toplu onay.
 *
 * §11.3: "ekstre importu saldiri yuzeyidir" — dosya Zod'dan gecer, hucreler CSV injection'a
 * karsi etkisizlestirilir (cellToText → neutralizeFormula), tutar client'tan DEGIL DB'den okunur.
 */
@Injectable()
export class StatementService {
  private readonly logger = new Logger(StatementService.name);

  constructor(
    private readonly repo: CollectionsRepository,
    private readonly excel: ExcelParser,
    private readonly storage: StorageService,
    private readonly intents: IntentFactory,
    private readonly bankTransfer: BankTransferProvider,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- 1) yukle → staging

  async import(file: UploadedFile, user: RequestUser) {
    if (!file) throw new AppError(ErrorCode.VALIDATION_ERROR, 'Dosya yuklenmedi');
    if (file.size > MAX_STATEMENT_BYTES) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Dosya 10 MB sinirini asiyor');
    }

    const isCsv = /\.csv$/i.test(file.originalname);
    const sheet = isCsv
      ? await this.excel.parseCsv(file.buffer, ImportTarget.BANK_STATEMENT)
      : await this.excel.parse(file.buffer, ImportTarget.BANK_STATEMENT);

    const parsed: { rowNo: number; txDate: Date; description: string; amount: MoneyString }[] = [];
    const errors: { rowNo: number; error: string }[] = [];
    let skippedOutgoing = 0;

    for (const raw of sheet.rows) {
      const { __rowNo: rowNo, ...values } = raw as { __rowNo: number } & Record<string, unknown>;
      const incoming = incomingAmount(values);

      // Hesaptan CIKAN hareketler tahsilat degildir — hata degil, konu disi.
      if (!incoming) {
        skippedOutgoing += 1;
        continue;
      }

      const result = bankStatementRowSchema.safeParse({
        txDate: values.documentDate,
        description: values.description,
        amount: incoming,
      });
      if (!result.success) {
        errors.push({
          rowNo,
          error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '),
        });
        continue;
      }
      parsed.push({ rowNo, ...result.data });
    }

    if (parsed.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Ekstrede gelen odeme satiri bulunamadi', {
        skippedOutgoing,
        errors: errors.slice(0, 20),
      });
    }

    const fileHash = this.storage.hash(file.buffer);
    const fileUrl = await this.storage.archive(
      `statements/${user.sellerId}/${fileHash}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );

    const batch = await this.repo.createStatementBatch({
      sourceType: ImportSourceType.BANK_STATEMENT,
      target: ImportTarget.BANK_STATEMENT,
      fileName: file.originalname,
      fileUrl,
      fileHash,
      status: 'PARSED',
      mapping: sheet.mapping,
      totals: {
        rowCount: parsed.length,
        skippedOutgoing,
        errorCount: errors.length,
        totalIncoming: sum(parsed.map((r) => r.amount)),
      },
      createdById: user.userId,
    });

    await this.repo.createStatementRows(
      parsed.map((row) => ({
        importId: batch.id,
        rowNo: row.rowNo,
        txDate: row.txDate,
        amount: row.amount,
        description: row.description,
      })),
    );

    await this.audit.log({
      action: 'STATEMENT_IMPORTED',
      entity: 'ImportBatch',
      entityId: batch.id,
      after: { fileName: file.originalname, rowCount: parsed.length },
    });

    return { ...(await this.matches(batch.id)), skippedOutgoing, errors: errors.slice(0, 20) };
  }

  // ---------------------------------------------------------------- 2) eslestirme onerisi

  async matches(batchId: string) {
    const batch = await this.repo.findBatch(batchId);
    if (!batch) throw new AppError(ErrorCode.NOT_FOUND, 'Ekstre yuklemesi bulunamadi');

    const [rows, intents, { accounts, history }] = await Promise.all([
      this.repo.statementRows(batchId),
      this.repo.pendingIntents(),
      this.repo.accountCodes(),
    ]);

    const codes: AccountCodeRef[] = [
      ...accounts.map((a) => ({ buyerAccountId: a.id, accountCode: a.accountCode })),
      ...history.map((h) => ({ buyerAccountId: h.buyerAccountId, accountCode: h.oldCode })),
    ];

    // Onaylanmis satirlar yeniden eslestirilmez (idempotency — satir seviyesinde).
    const open = rows.filter((r) => !r.matchedIntentId);
    const suggestions = matchStatementRows(
      open.map((r) => ({
        id: r.id,
        description: r.description,
        amount: toMoney(r.amount.toString()),
      })),
      intents.map((i) => ({
        id: i.id,
        referenceCode: i.referenceCode,
        buyerAccountId: i.buyerAccountId,
        amount: toMoney(i.amount.toString()),
      })),
      codes,
    );

    const byRow = new Map(suggestions.map((s) => [s.rowId, s]));
    const titleOf = new Map(accounts.map((a) => [a.id, `${a.accountCode} · ${a.title}`]));

    return {
      batchId,
      fileName: batch.fileName,
      rows: rows.map((row) => toRowView(row)),
      matches: rows.map((row) => decorate(row.id, byRow.get(row.id), titleOf)),
      pendingIntentCount: intents.length,
    };
  }

  // ---------------------------------------------------------------- 3) toplu onay

  /**
   * Her satir ya bir bekleyen talebe ya da dogrudan bir cariye baglanir.
   * Cariye baglanan satir icin sistem kendi talebini acar → tek hat (§8: iki kanal ayni hatta).
   * Satirin TUTARI client'tan degil DB'den okunur; onaylayan yalniz eslesmeyi secer.
   */
  async bulkConfirm(batchId: string, input: BulkConfirmInput, user: RequestUser) {
    const batch = await this.repo.findBatch(batchId);
    if (!batch) throw new AppError(ErrorCode.NOT_FOUND, 'Ekstre yuklemesi bulunamadi');

    const rows = await this.repo.statementRows(batchId);
    const byId = new Map(rows.map((r) => [r.id, r]));

    const results: {
      rowId: string;
      status: 'CONFIRMED' | 'ALREADY_MATCHED' | 'FAILED';
      intentId?: string;
      transactionId?: string | null;
      remainderIntentId?: string | null;
      error?: string;
    }[] = [];

    for (const match of input.matches) {
      const row = byId.get(match.rowId);
      if (!row) {
        results.push({ rowId: match.rowId, status: 'FAILED', error: 'Satir bu ekstrede yok' });
        continue;
      }
      if (row.matchedIntentId) {
        results.push({ rowId: row.id, status: 'ALREADY_MATCHED', intentId: row.matchedIntentId });
        continue;
      }

      try {
        const amount = toMoney(row.amount.toString());
        const intentId = match.intentId ?? (await this.openIntentFor(match, amount, user));

        const result = await this.bankTransfer.reconcile({
          intentId,
          amount,
          statementRowId: row.id,
          actorUserId: user.userId,
          valueDate: row.txDate,
          note: `Banka ekstresi: ${row.description.slice(0, 120)}`,
        });

        results.push({
          rowId: row.id,
          status: result.alreadyConfirmed ? 'ALREADY_MATCHED' : 'CONFIRMED',
          intentId: result.intentId,
          transactionId: result.transactionId,
          remainderIntentId: result.remainderIntentId,
        });
      } catch (error) {
        // Bir satirin hatasi digerlerini dusurmez; her satir kendi transaction'inda islenir.
        const message = error instanceof AppError ? error.message : 'Satir onaylanamadi';
        this.logger.warn({ rowId: row.id, err: error }, 'Ekstre satiri onaylanamadi');
        results.push({ rowId: row.id, status: 'FAILED', error: message });
      }
    }

    const confirmed = results.filter((r) => r.status === 'CONFIRMED').length;
    if (confirmed > 0 && rows.every((r) => r.matchedIntentId || isConfirmed(results, r.id))) {
      await this.repo.updateBatch(batchId, { status: 'COMMITTED' });
    }

    await this.audit.log({
      action: 'STATEMENT_BULK_CONFIRMED',
      entity: 'ImportBatch',
      entityId: batchId,
      after: { confirmed, total: input.matches.length },
    });

    return { batchId, confirmed, results };
  }

  /** Aciklamasiz/referanssiz dekont: insan cariyi secer, talep sistemce acilir. */
  private async openIntentFor(
    match: { buyerAccountId?: string },
    amount: MoneyString,
    user: RequestUser,
  ): Promise<string> {
    if (!match.buyerAccountId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Satir bir tahsilata veya cariye baglanmali');
    }
    if (!user.sellerId) throw new AppError(ErrorCode.TENANT_FORBIDDEN);

    const intent = await this.intents.createPending({
      sellerId: user.sellerId,
      buyerAccountId: match.buyerAccountId,
      amount,
      channel: 'BANK_TRANSFER',
      createdByUserId: user.userId,
    });
    return intent.id;
  }
}

const isConfirmed = (results: { rowId: string; status: string }[], rowId: string): boolean =>
  results.some((r) => r.rowId === rowId && r.status !== 'FAILED');

function toRowView(row: {
  id: string;
  rowNo: number;
  txDate: Date;
  description: string;
  amount: { toString(): string };
  matchedIntentId: string | null;
}): StatementRowView {
  return {
    id: row.id,
    rowNo: row.rowNo,
    txDate: row.txDate.toISOString().slice(0, 10),
    description: row.description,
    amount: toMoney(row.amount.toString()),
    matchedIntentId: row.matchedIntentId,
  };
}

/** Onaylanmis satirlar icin oneri uretilmez; panel "islenmis" rozeti gosterir. */
function decorate(
  rowId: string,
  match: StatementMatch | undefined,
  titleOf: Map<string, string>,
): StatementMatch & { buyerAccountLabel: string | null; partial: boolean } {
  const base: StatementMatch = match ?? {
    rowId,
    confidence: 'NONE',
    intentId: null,
    buyerAccountId: null,
    amountMatches: false,
    difference: null,
    reason: 'Bu satir zaten islenmis',
  };
  return {
    ...base,
    buyerAccountLabel: base.buyerAccountId ? (titleOf.get(base.buyerAccountId) ?? null) : null,
    partial: base.difference !== null && gt(base.difference, '0.00'),
  };
}

/**
 * Ekstrede gelen para: "tutar" veya "alacak" kolonu. Yalniz "borc" varsa cikis hareketidir.
 * Bazi bankalar cikisi negatif tutarla yazar → negatif satirlar da atlanir.
 */
function incomingAmount(values: Record<string, unknown>): MoneyString | null {
  const credit = typeof values.credit === 'string' ? values.credit : null;
  if (credit && gt(credit, '0.00')) return toMoney(credit);

  const amount = typeof values.amount === 'string' ? values.amount : null;
  if (amount && gt(amount, '0.00')) return toMoney(amount);

  return null;
}
