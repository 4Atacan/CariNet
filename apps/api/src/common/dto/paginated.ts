import { type PaginationMeta } from '@carinet/shared';

/**
 * Controller sayfali sonuc dondururken bunu kullanir; ResponseInterceptor
 * meta'yi zarfin ust seviyesine tasir (§10).
 */
export class Paginated<T> {
  constructor(
    readonly data: T[],
    readonly meta: PaginationMeta,
  ) {}

  static of<T>(data: T[], page: number, limit: number, total: number): Paginated<T> {
    return new Paginated(data, { page, limit, total });
  }
}
