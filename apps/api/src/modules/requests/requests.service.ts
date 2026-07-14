import { Inject, Injectable } from '@nestjs/common';
import { type Prisma, type SupportRequest } from '@prisma/client';
import {
  AppError,
  ErrorCode,
  NotificationType,
  RequestStatus,
  UserRole,
  paginate,
  type CreateRequestInput,
  type ReplyRequestInput,
  type RequestListQuery,
} from '@carinet/shared';
import { AuditService } from '../../common/audit/audit.service';
import { Paginated } from '../../common/dto/paginated';
import { type RequestUser } from '../../common/types/request-with-user';
import { PRISMA, type PrismaService } from '../../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * §13 Faz 4 — Talep-Oneri. Alici yazar, satici yanitlar.
 * §9: devir mutabakatina itiraz da buradan akar (RECONCILIATION_OBJECTION).
 */
@Injectable()
export class RequestsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async list(query: RequestListQuery, user: RequestUser) {
    const where: Prisma.SupportRequestWhereInput = {
      // Alici YALNIZ kendi carisinin taleplerini gorur (§11.2 IDOR).
      ...(user.role === UserRole.BUYER_USER ? { buyerAccountId: user.buyerAccountId ?? '' } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const { skip, take } = paginate(query.page, query.limit);
    const [rows, total] = await Promise.all([
      this.prisma.supportRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { buyerAccount: { select: { id: true, accountCode: true, title: true } } },
      }),
      this.prisma.supportRequest.count({ where }),
    ]);
    return Paginated.of(rows.map(toDto), query.page, query.limit, total);
  }

  /** Talebi ALICI acar. */
  async create(input: CreateRequestInput, user: RequestUser) {
    if (!user.buyerAccountId || !user.sellerId) {
      throw new AppError(ErrorCode.TENANT_FORBIDDEN, 'Talep yalniz cari hesap baglaminda acilir');
    }

    const request = await this.prisma.supportRequest.create({
      data: {
        buyerAccountId: user.buyerAccountId,
        createdById: user.userId,
        type: input.type,
        subject: input.subject,
        body: input.body,
      } as Prisma.SupportRequestUncheckedCreateInput,
    });

    await this.audit.log({
      action: 'REQUEST_CREATED',
      entity: 'SupportRequest',
      entityId: request.id,
      after: { type: request.type, subject: request.subject },
    });
    return toDto(request);
  }

  /** Yaniti SATICI verir → aliciya bildirim + push gider. */
  async reply(id: string, input: ReplyRequestInput, user: RequestUser) {
    const before = await this.prisma.supportRequest.findFirst({ where: { id } });
    if (!before) throw new AppError(ErrorCode.NOT_FOUND);

    const after = await this.prisma.supportRequest.update({
      where: { id },
      data: {
        reply: input.reply,
        status: input.status,
        repliedById: user.userId,
        repliedAt: new Date(),
      },
    });

    const members = await this.prisma.accountMembership.findMany({
      where: { buyerAccountId: before.buyerAccountId },
      select: { userId: true },
    });

    await this.notifications.notifyAndPush({
      userIds: members.map((m) => m.userId),
      sellerId: before.sellerId,
      buyerAccountId: before.buyerAccountId,
      title: 'Talebiniz yanitlandi',
      body: `"${before.subject}" konulu talebiniz yanitlandi.`,
      type: NotificationType.SYSTEM,
      entityId: id,
    });

    await this.audit.log({
      action: 'REQUEST_REPLIED',
      entity: 'SupportRequest',
      entityId: id,
      before: { status: before.status },
      after: { status: after.status },
    });
    return toDto(after);
  }

  /** Satici talebi kapatir (yanitsiz de kapatilabilir). Kayit SILINMEZ (izlenebilirlik). */
  async close(id: string) {
    const request = await this.prisma.supportRequest.findFirst({ where: { id } });
    if (!request) throw new AppError(ErrorCode.NOT_FOUND);

    const closed = await this.prisma.supportRequest.update({
      where: { id },
      data: { status: RequestStatus.CLOSED },
    });
    await this.audit.log({
      action: 'REQUEST_CLOSED',
      entity: 'SupportRequest',
      entityId: id,
      before: { status: request.status },
      after: { status: RequestStatus.CLOSED },
    });
    return toDto(closed);
  }
}

type RequestRow = SupportRequest & {
  buyerAccount?: { id: string; accountCode: string; title: string } | null;
};

function toDto(row: RequestRow) {
  return {
    id: row.id,
    buyerAccountId: row.buyerAccountId,
    buyerAccount: row.buyerAccount ?? null,
    type: row.type,
    subject: row.subject,
    body: row.body,
    status: row.status,
    reply: row.reply,
    repliedAt: row.repliedAt,
    createdAt: row.createdAt,
  };
}
