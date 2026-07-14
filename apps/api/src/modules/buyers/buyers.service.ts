import { Injectable } from '@nestjs/common';
import { type BuyerAccount, type Representative } from '@prisma/client';
import {
  AppError,
  ErrorCode,
  UserRole,
  paginate,
  toMoney,
  type BuyerListQuery,
  type CreateBuyerAccountInput,
  type DateRangeQuery,
  type PaginationQuery,
  type UpdateBuyerAccountInput,
} from '@carinet/shared';
import { AuditService } from '../../common/audit/audit.service';
import { Paginated } from '../../common/dto/paginated';
import { type RequestUser } from '../../common/types/request-with-user';
import { LedgerService, type AccountBalance } from '../ledger/ledger.service';
import { BuyersRepository } from './buyers.repository';

type BuyerWithRepresentative = BuyerAccount & {
  representative: Pick<Representative, 'id' | 'fullName' | 'phone'> | null;
};

@Injectable()
export class BuyersService {
  constructor(
    private readonly repo: BuyersRepository,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  /** Listede CANLI bakiye (kural #2: kolon yok, her istekte turetilir). */
  async list(query: BuyerListQuery) {
    const { skip, take } = paginate(query.page, query.limit);
    const { rows, total } = await this.repo.findMany(query, skip, take);
    const balances = await this.ledger.balancesOf(rows.map((r) => r.id));

    const data = rows.map((row) => ({
      ...toBuyerDto(row),
      balance: balances.get(row.id)!,
    }));
    return Paginated.of(data, query.page, query.limit, total);
  }

  /**
   * Tenant filtresi Prisma katmaninda otomatik. Ek olarak BUYER_USER yalniz KENDI carisini gorur
   * (ayni satici icinde bile yatay yetki asimi olmasin — §11.2 IDOR).
   */
  async findOne(id: string, user: RequestUser) {
    this.assertOwnAccount(id, user);
    const account = await this.repo.findById(id);
    if (!account) throw new AppError(ErrorCode.NOT_FOUND);

    const { _count, ...rest } = account;
    return {
      ...toBuyerDto(rest),
      balance: await this.ledger.balanceOf(id),
      userCount: _count.memberships,
      transactionCount: _count.transactions,
    };
  }

  /** Mobil Dashboard (§13 Faz 1): cari kodu, bakiye, limit, temsilci, son 10 hareket. */
  async dashboard(user: RequestUser) {
    if (!user.buyerAccountId) throw new AppError(ErrorCode.TENANT_FORBIDDEN);
    const account = await this.repo.findById(user.buyerAccountId);
    if (!account) throw new AppError(ErrorCode.NOT_FOUND);

    const [balance, recent] = await Promise.all([
      this.ledger.balanceOf(account.id),
      this.repo.recentTransactions(account.id),
    ]);

    const { _count: _unused, ...rest } = account;
    return {
      account: toBuyerDto(rest),
      balance,
      recentTransactions: recent.map((t) => ({
        id: t.id,
        type: t.type,
        documentType: t.documentType,
        documentNo: t.documentNo,
        documentDate: toIsoDate(t.documentDate),
        dueDate: t.dueDate ? toIsoDate(t.dueDate) : null,
        amount: toMoney(t.amount.toString()),
        currencyCode: t.currencyCode.trim(),
        description: t.description,
      })),
    };
  }

  /** Ekstre — yuruyen bakiye ile (§6.4). */
  async statement(id: string, user: RequestUser, query: PaginationQuery & DateRangeQuery) {
    this.assertOwnAccount(id, user);
    const account = await this.repo.findById(id);
    if (!account) throw new AppError(ErrorCode.NOT_FOUND);

    const { skip, take } = paginate(query.page, query.limit);
    const { rows, total } = await this.ledger.statement(id, {
      from: query.from,
      to: query.to,
      skip,
      take,
    });
    return Paginated.of(rows, query.page, query.limit, total);
  }

  async create(input: CreateBuyerAccountInput) {
    const existing = await this.repo.findByAccountCode(input.accountCode);
    if (existing) {
      throw new AppError(ErrorCode.CONFLICT, 'Bu cari kodu zaten kullaniliyor');
    }
    const account = await this.repo.create(input);
    await this.audit.log({
      action: 'CREATE',
      entity: 'BuyerAccount',
      entityId: account.id,
      after: account,
    });
    return toBuyerDto(account);
  }

  async update(id: string, input: UpdateBuyerAccountInput) {
    const before = await this.repo.findById(id);
    if (!before) throw new AppError(ErrorCode.NOT_FOUND);

    if (input.accountCode && input.accountCode !== before.accountCode) {
      const clash = await this.repo.findByAccountCode(input.accountCode);
      if (clash) throw new AppError(ErrorCode.CONFLICT, 'Bu cari kodu zaten kullaniliyor');
      // Eski kod, havale eslestirmesi icin tarihcede saklanir (§7).
      await this.repo.recordCodeChange(id, before.accountCode);
    }

    const after = await this.repo.update(id, input);
    await this.audit.log({
      action: 'UPDATE',
      entity: 'BuyerAccount',
      entityId: id,
      before,
      after,
    });
    return toBuyerDto(after);
  }

  /**
   * Kural #4: cari hesap finansal kayit tasir → HARD DELETE YOK. Pasife alinir;
   * hareketleri ve ekstresi durur, yeni kayit girilemez.
   */
  async setActive(id: string, isActive: boolean) {
    const before = await this.repo.findById(id);
    if (!before) throw new AppError(ErrorCode.NOT_FOUND);
    const after = await this.repo.update(id, { isActive });
    await this.audit.log({
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
      entity: 'BuyerAccount',
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive },
    });
    return toBuyerDto(after);
  }

  async codeHistory(id: string, user: RequestUser) {
    this.assertOwnAccount(id, user);
    const account = await this.repo.findById(id);
    if (!account) throw new AppError(ErrorCode.NOT_FOUND);
    return this.repo.listCodeHistory(id);
  }

  /** Hareket/fatura girisinde cari dogrulamasi — baska tenant'in carisi burada NOT_FOUND olur. */
  async requireActiveAccount(id: string) {
    const account = await this.repo.findById(id);
    if (!account) throw new AppError(ErrorCode.NOT_FOUND, 'Cari hesap bulunamadi');
    if (!account.isActive) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Pasif cari hesaba kayit girilemez');
    }
    return account;
  }

  private assertOwnAccount(id: string, user: RequestUser): void {
    if (user.role === UserRole.BUYER_USER && user.buyerAccountId !== id) {
      throw new AppError(ErrorCode.TENANT_FORBIDDEN);
    }
  }
}

export interface BuyerDto {
  id: string;
  accountCode: string;
  title: string;
  vknTckn: string | null;
  creditLimit: string;
  isActive: boolean;
  representative: Pick<Representative, 'id' | 'fullName' | 'phone'> | null;
  createdAt: Date;
}

export interface BuyerWithBalance extends BuyerDto {
  balance: AccountBalance;
}

/** Decimal → MoneyString (kural #1: sinirdan number cikmaz). */
function toBuyerDto(row: BuyerWithRepresentative): BuyerDto {
  return {
    id: row.id,
    accountCode: row.accountCode,
    title: row.title,
    vknTckn: row.vknTckn,
    creditLimit: toMoney(row.creditLimit.toString()),
    isActive: row.isActive,
    representative: row.representative ?? null,
    createdAt: row.createdAt,
  };
}

const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);
