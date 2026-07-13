import { AsyncLocalStorage } from 'node:async_hooks';
import { type UserRole } from '@carinet/shared';

/**
 * CLAUDE.md §6.1 — uclu hattin 3. kemeri.
 * Istek baglami AsyncLocalStorage'da tasinir; Prisma eklentisi (prisma.service.ts) her tenant
 * sorgusunda buradan seller_id okur. Bagam yoksa tenant modeline sorgu ATILAMAZ.
 */
export interface TenantStore {
  userId: string | null;
  role: UserRole | null;
  sellerId: string | null;
  buyerAccountId: string | null;
  /** Sistem isleri (seed, cron, platform admin, auth oncesi) — tenant filtresi zorunlu degil. */
  system: boolean;
}

const storage = new AsyncLocalStorage<TenantStore>();

const EMPTY: TenantStore = {
  userId: null,
  role: null,
  sellerId: null,
  buyerAccountId: null,
  system: false,
};

export const TenantContext = {
  /** Istek baglamini kurar; icindeki her sey (repository dahil) bu store'u gorur. */
  run<T>(store: Partial<TenantStore>, fn: () => T): T {
    return storage.run({ ...EMPTY, ...store }, fn);
  },

  /**
   * Tenant filtresini gecici olarak devre disi birakir. Yalniz auth-oncesi/seed/cron/platform-admin.
   * DIKKAT: Prisma promise'leri LAZY'dir — sorgu ancak await edilince calisir. Bu yuzden await
   * baglamin ICINDE yapilmali; aksi halde eklenti sorguyu baglamsiz gorur.
   */
  async runAsSystem<T>(fn: () => Promise<T>): Promise<T> {
    const current = storage.getStore() ?? EMPTY;
    return storage.run({ ...current, system: true }, async () => await fn());
  },

  get(): TenantStore {
    return storage.getStore() ?? EMPTY;
  },

  getSellerId(): string | null {
    return storage.getStore()?.sellerId ?? null;
  },

  isSystem(): boolean {
    return storage.getStore()?.system ?? false;
  },
};
