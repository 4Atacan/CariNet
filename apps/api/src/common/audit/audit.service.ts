import { Inject, Injectable, Logger } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { PRISMA, type PrismaService, type TxClient } from '../../prisma/prisma.module';
import { TenantContext } from '../tenant/tenant-context';

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  /** Baglamda yoksa (sistem isleri) acikca verilir. */
  sellerId?: string | null;
  actorUserId?: string | null;
}

/**
 * Kural #4 / §11.8 — finansal degisimde audit ZORUNLU.
 * AuditLog tenant modeli degildir (seller_id nullable, platform admin kayitlari da tutar),
 * bu yuzden seller_id'yi eklenti degil BURASI yazar: baglamdan okunur.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  /**
   * Ayni DB transaction'i icinde yazmak icin `tx` verilir — finansal kayit ile audit
   * ya birlikte yazilir ya hic yazilmaz.
   */
  async log(entry: AuditEntry, tx?: TxClient): Promise<void> {
    const ctx = TenantContext.get();
    const client = tx ?? this.prisma;

    try {
      await client.auditLog.create({
        data: {
          actorUserId: entry.actorUserId ?? ctx.userId,
          sellerId: entry.sellerId ?? ctx.sellerId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          before: toJson(entry.before),
          after: toJson(entry.after),
        },
      });
    } catch (error) {
      // Transaction disindaki audit yazimi ana islemi cokertmemeli; ama sessiz de kalmamali.
      if (tx) throw error;
      this.logger.error({ err: error, entry }, 'Audit kaydi yazilamadi');
    }
  }
}

/** Decimal / Date gibi tipleri JSON'a guvenli cevirir; undefined → Prisma.JsonNull yerine null. */
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value, jsonReplacer)) as Prisma.InputJsonValue;
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toFixed' in value) {
    return String(value); // Prisma.Decimal
  }
  return value;
}
