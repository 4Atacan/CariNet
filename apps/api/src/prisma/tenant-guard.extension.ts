import { Prisma } from '@prisma/client';
import { AppError, ErrorCode } from '@carinet/shared';
import { TenantContext } from '../common/tenant/tenant-context';

/**
 * CLAUDE.md kural #3 / §6.1 — "repository katmani filtresiz sorgu calistiramaz".
 * Bu eklenti, seller_id tasiyan HER modelde sorguyu tenant baglamiyla zorla filtreler.
 * Baglam yoksa (ve sistem modu degilse) sorgu calismaz — sessizce tum kiracilari donmez.
 */

/** seller_id kolonu olan modeller. Yeni tenant tablosu eklendiginde BURAYA da eklenmeli. */
export const TENANT_MODELS: ReadonlySet<string> = new Set([
  'BuyerAccount',
  'Representative',
  'Transaction',
  'Invoice',
  'Product',
  'Stock',
  'Campaign',
  'SellerBankAccount',
  'SellerPosConfig',
  'CollectIntent',
  'BankStatementRow',
  'ImportBatch',
  'ImportTemplate',
  'Invite',
  'Notification',
  'SellerMember',
  'SupportRequest',
  // PushToken BILEREK yok: token kullanici+cihaz bazlidir, satici bazli degil (§6.2).
  // Hangi baglamda bildirim gittigi PAYLOAD'da tasinir (sellerId + buyerAccountId).
]);

const WHERE_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);

type Args = Record<string, unknown>;

const isPlainObject = (v: unknown): v is Args =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const tenantForbidden = (model: string, detail: string) =>
  new AppError(ErrorCode.TENANT_FORBIDDEN, `Tenant ihlali (${model}): ${detail}`);

function injectWhere(model: string, args: Args, sellerId: string): Args {
  const where = isPlainObject(args.where) ? args.where : {};
  if (where.sellerId !== undefined && where.sellerId !== sellerId) {
    throw tenantForbidden(model, 'baska bir saticinin verisi sorgulanamaz');
  }
  return { ...args, where: { ...where, sellerId } };
}

function injectData(model: string, data: unknown, sellerId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((row) => injectData(model, row, sellerId));
  }
  if (!isPlainObject(data)) return data;
  if (data.sellerId !== undefined && data.sellerId !== sellerId) {
    throw tenantForbidden(model, 'baska bir satici adina kayit olusturulamaz');
  }
  if (isPlainObject(data.seller)) {
    // İliski uzerinden baglaniyorsa (seller: { connect: { id } }) sellerId'yi elle koymayiz.
    return data;
  }
  return { ...data, sellerId };
}

export const tenantGuardExtension = Prisma.defineExtension({
  name: 'tenantGuard',
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        if (!TENANT_MODELS.has(model) || TenantContext.isSystem()) {
          return query(args);
        }

        const sellerId = TenantContext.getSellerId();
        if (!sellerId) {
          throw tenantForbidden(
            model,
            'tenant baglami olmadan sorgu calistirilamaz (TenantContext bos)',
          );
        }

        const typedArgs: Args = isPlainObject(args) ? args : {};
        // Args, tum modellerin birlesim tipi oldugu icin geri donusu orijinal tipe daraltiyoruz.
        const pass = (next: Args) => query(next as typeof args);

        if (operation === 'upsert') {
          const withWhere = injectWhere(model, typedArgs, sellerId);
          return pass({ ...withWhere, create: injectData(model, withWhere.create, sellerId) });
        }

        if (CREATE_OPS.has(operation)) {
          return pass({ ...typedArgs, data: injectData(model, typedArgs.data, sellerId) });
        }

        if (WHERE_OPS.has(operation)) {
          return pass(injectWhere(model, typedArgs, sellerId));
        }

        return query(args);
      },
    },
  },
});
