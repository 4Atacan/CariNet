import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AppError,
  DocumentType,
  ErrorCode,
  NotificationType,
  TransactionType,
  formatMoney,
  gt,
  sub,
  toMoney,
  type CollectChannel,
  type IntentStatus,
} from '@carinet/shared';
import { AuditService } from '../../common/audit/audit.service';
import { PRISMA, type PrismaService } from '../../prisma/prisma.module';
import { NotificationsService, type NotifyInput } from '../notifications/notifications.service';
import { CollectionsRepository } from './collections.repository';
import { IntentFactory } from './intent-factory.service';
import { type CollectionResult, type ReconcileInput } from './providers/collection-provider';

/**
 * §8 ORTAK HAT — iki kanal burada birlesir:
 *   CONFIRMED → otomatik CREDIT → bakiye duser (kural #2) → bildirim → audit.
 *
 * Idempotency uc katmanlidir (§13 Faz 3 bitti kriteri 3):
 *   1) intent: PENDING→CONFIRMED compare-and-set. Ikinci cagri 0 satir gunceller.
 *   2) ekstre satiri: bank_statement_rows.matched_intent_id UNIQUE (DB kilidi).
 *   3) CREDIT: intent'e bagli iptal edilmemis hareket varsa YENISI YAZILMAZ.
 * Hepsi TEK transaction icinde — yarim kalmis onay yok.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaService,
    private readonly repo: CollectionsRepository,
    private readonly intents: IntentFactory,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async apply(input: ReconcileInput, channel: CollectChannel): Promise<CollectionResult> {
    /** Push TRANSACTION DISINDA gonderilir: geri alinan bir tahsilat icin telefon otmemeli. */
    let pushAfterCommit: NotifyInput | null = null;

    const result = await this.prisma.$transaction(async (tx) => {
      const intent = await this.repo.findIntent(input.intentId, tx);
      if (!intent) throw new AppError(ErrorCode.NOT_FOUND, 'Odeme talebi bulunamadi');

      // (3) Zaten islenmis mi? Ayni kanit ikinci kez geldiginde HICBIR SEY yazma.
      const existing = await this.repo.findCreditOfIntent(intent.id, tx);
      if (existing) {
        this.logger.warn(
          { intentId: intent.id, transactionId: existing.id },
          'Tahsilat zaten islenmis — tekrar eden onay yok sayildi',
        );
        return {
          intentId: intent.id,
          status: intent.status as IntentStatus,
          transactionId: existing.id,
          creditedAmount: toMoney(existing.amount.toString()),
          remainderIntentId: null,
          alreadyConfirmed: true,
        };
      }

      if (intent.status !== 'PENDING') {
        throw new AppError(
          ErrorCode.INTENT_NOT_PENDING,
          intent.status === 'EXPIRED'
            ? 'Odeme talebinin suresi dolmus'
            : 'Odeme talebi iptal edilmis',
        );
      }
      if (!intent.buyerAccountId) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Odeme talebi bir cariye bagli degil');
      }

      // (2) Ekstre satiri kilidi — satir zaten baska bir tahsilata bagliysa dur.
      if (input.statementRowId) {
        const matched = await this.repo.matchStatementRow(input.statementRowId, intent.id, tx);
        if (!matched) throw new AppError(ErrorCode.ROW_ALREADY_MATCHED);
      }

      // (1) Compare-and-set: yalniz PENDING iken CONFIRMED. Yaris kaybeden 0 satir gunceller.
      const won = await this.repo.confirmIfPending(
        intent.id,
        { confirmedById: input.actorUserId ?? null, providerRef: input.providerRef },
        tx,
      );
      if (!won) throw new AppError(ErrorCode.ALREADY_CONFIRMED);

      const credited = toMoney(input.amount);
      const documentDate = input.valueDate ?? new Date();

      // Kural #2: bakiye kolonu yok — CREDIT hareketi yazilir, bakiye ondan turetilir.
      const transaction = await this.repo.createCredit(
        {
          buyerAccountId: intent.buyerAccountId,
          type: TransactionType.CREDIT,
          documentType:
            channel === 'CARD_POS' ? DocumentType.PAYMENT : DocumentType.TRANSFER_RECEIPT,
          documentNo: intent.referenceCode,
          documentDate,
          amount: credited,
          currencyCode: intent.currencyCode,
          exchangeRate: '1', // tahsilat TRY (§schemas/collections)
          description: describe(channel, input),
          collectIntentId: intent.id,
          createdById: input.actorUserId ?? null,
        },
        tx,
      );

      // §8 kismi odeme: gerceklesen islenir, FARK yeni bir bekleyen talep olur.
      const remainder = sub(intent.amount.toString(), credited);
      let remainderIntentId: string | null = null;
      if (gt(remainder, '0.00')) {
        const created = await this.intents.createPending(
          {
            sellerId: intent.sellerId,
            buyerAccountId: intent.buyerAccountId,
            amount: remainder,
            channel: intent.channel as CollectChannel,
            createdByUserId: input.actorUserId ?? null,
          },
          tx,
        );
        remainderIntentId = created.id;
      }

      const members = await this.repo.membersOfAccount(intent.buyerAccountId, tx);
      const notification: NotifyInput = {
        userIds: members.map((m) => m.userId),
        sellerId: intent.sellerId,
        buyerAccountId: intent.buyerAccountId,
        title: 'Odemeniz alindi',
        body: `${formatMoney(credited)} tutarindaki odemeniz hesabiniza islendi.`,
        type: NotificationType.COLLECTION_CONFIRMED,
        entityId: intent.id,
      };
      await this.notifications.notify(notification, tx);
      pushAfterCommit = notification;

      await this.audit.log(
        {
          action: 'COLLECTION_CONFIRMED',
          entity: 'CollectIntent',
          entityId: intent.id,
          before: { status: 'PENDING', amount: intent.amount.toString() },
          after: {
            status: 'CONFIRMED',
            channel,
            creditedAmount: credited,
            transactionId: transaction.id,
            statementRowId: input.statementRowId ?? null,
            providerRef: input.providerRef ?? null,
            remainderIntentId,
            note: input.note ?? null,
          },
          actorUserId: input.actorUserId ?? null,
          sellerId: intent.sellerId,
        },
        tx,
      );

      return {
        intentId: intent.id,
        status: 'CONFIRMED' as IntentStatus,
        transactionId: transaction.id,
        creditedAmount: credited,
        remainderIntentId,
        alreadyConfirmed: false,
      };
    });

    // Commit BASARILI → telefonu simdi caldir (§13 Faz 4 ortak hat: CONFIRMED → CREDIT → push).
    if (pushAfterCommit) await this.notifications.sendPush(pushAfterCommit);
    return result;
  }
}

function describe(channel: CollectChannel, input: ReconcileInput): string {
  const base = channel === 'CARD_POS' ? 'Kartli tahsilat (satici POS)' : 'Havale/EFT tahsilati';
  const evidence = input.providerRef
    ? ` · saglayici ref: ${input.providerRef}`
    : input.statementRowId
      ? ' · banka ekstresi eslesmesi'
      : ' · manuel onay';
  return `${base}${evidence}`;
}
