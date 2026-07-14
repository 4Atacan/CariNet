import { Inject, Injectable } from '@nestjs/common';
import { type Campaign, type Prisma } from '@prisma/client';
import {
  AppError,
  ErrorCode,
  NotificationType,
  UserRole,
  paginate,
  type AnnounceCampaignInput,
  type CampaignListQuery,
  type CreateCampaignInput,
} from '@carinet/shared';
import { AuditService } from '../../common/audit/audit.service';
import { Paginated } from '../../common/dto/paginated';
import { type RequestUser } from '../../common/types/request-with-user';
import { PRISMA, type PrismaService } from '../../prisma/prisma.module';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { NotificationsService } from '../notifications/notifications.service';

/** §13 Faz 4 — kampanyalar + push duyurusu (payload hesap baglamli). */
@Injectable()
export class CampaignsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly notificationsRepo: NotificationsRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: CampaignListQuery, user: RequestUser) {
    const now = new Date();
    // Alici YALNIZ yayinda olan kampanyalari gorur; satici arsivi de gorur.
    const activeOnly = user.role === UserRole.BUYER_USER || query.activeOnly;
    const where: Prisma.CampaignWhereInput = activeOnly
      ? { startsAt: { lte: now }, endsAt: { gte: now } }
      : {};

    const { skip, take } = paginate(query.page, query.limit);
    const [rows, total] = await Promise.all([
      this.prisma.campaign.findMany({ where, skip, take, orderBy: { startsAt: 'desc' } }),
      this.prisma.campaign.count({ where }),
    ]);
    return Paginated.of(rows.map(toDto), query.page, query.limit, total);
  }

  async create(input: CreateCampaignInput) {
    const campaign = await this.prisma.campaign.create({
      data: {
        title: input.title,
        body: input.body,
        imageUrl: input.imageUrl,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      } as Prisma.CampaignUncheckedCreateInput,
    });

    await this.audit.log({
      action: 'CREATE',
      entity: 'Campaign',
      entityId: campaign.id,
      after: campaign,
    });
    return toDto(campaign);
  }

  async remove(id: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id } });
    if (!campaign) throw new AppError(ErrorCode.NOT_FOUND);

    // Kampanya finansal kayit degildir → hard delete serbest (kural #4).
    await this.prisma.campaign.delete({ where: { id } });
    await this.audit.log({
      action: 'DELETE',
      entity: 'Campaign',
      entityId: id,
      before: campaign,
    });
    return { id, deleted: true };
  }

  /**
   * Duyuru: kampanyayi alicilara push'lar.
   * Bildirim HER CARI icin ayri yazilir — ayni kullanici iki carinin uyesiyse iki bildirim
   * alir ve her biri kendi hesabinin rozetine duser (§6.2 coklu uyelik).
   */
  async announce(id: string, input: AnnounceCampaignInput, user: RequestUser) {
    if (!user.sellerId) throw new AppError(ErrorCode.TENANT_FORBIDDEN);

    const campaign = await this.prisma.campaign.findFirst({ where: { id } });
    if (!campaign) throw new AppError(ErrorCode.NOT_FOUND);

    const accounts = await this.notificationsRepo.usersOfSeller(input.buyerAccountIds);
    let notified = 0;
    let pushed = 0;

    for (const account of accounts) {
      const userIds = account.memberships.map((m) => m.userId);
      if (userIds.length === 0) continue;

      const payload = {
        userIds,
        sellerId: user.sellerId,
        buyerAccountId: account.id,
        title: campaign.title,
        body: campaign.body,
        type: NotificationType.CAMPAIGN,
        entityId: campaign.id,
      };

      notified += await this.notifications.notify(payload);
      const result = await this.notifications.sendPush(payload);
      pushed += result.sent;
    }

    await this.audit.log({
      action: 'CAMPAIGN_ANNOUNCED',
      entity: 'Campaign',
      entityId: id,
      after: { accounts: accounts.length, notified, pushed },
    });

    return { campaignId: id, accounts: accounts.length, notified, pushed };
  }
}

function toDto(row: Campaign) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    imageUrl: row.imageUrl,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdAt: row.createdAt,
  };
}
