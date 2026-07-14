import * as SecureStore from 'expo-secure-store';
import {
  type ApiResponse,
  type ApiSuccess,
  type AuthTokens,
  type PaginationMeta,
} from '@carinet/shared';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

/** Kural #9: mobil tokenlari expo-secure-store'da tutar. AsyncStorage/localStorage YASAK. */
const ACCESS_KEY = 'carinet.access';
const REFRESH_KEY = 'carinet.refresh';

const REMEMBER_KEY = 'carinet.remember';

/**
 * "Beni hatirla" isaretli DEGILSE tokenlar yalniz bellekte tutulur:
 * uygulama kapaninca oturum biter. Isaretliyse SecureStore'a yazilir (kural #9).
 */
let memoryTokens: AuthTokens | null = null;

export const tokenStore = {
  async save(tokens: AuthTokens, remember?: boolean): Promise<void> {
    // Cagirana acikca soylenmediyse onceki tercihi surdur (refresh rotasyonu tercihi bozmasin).
    const persist = remember ?? (await SecureStore.getItemAsync(REMEMBER_KEY)) === 'true';

    memoryTokens = tokens;
    if (!persist) {
      await tokenStore.clearPersisted();
      return;
    }

    await SecureStore.setItemAsync(REMEMBER_KEY, 'true');
    await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
  },

  async getAccess(): Promise<string | null> {
    return memoryTokens?.accessToken ?? (await SecureStore.getItemAsync(ACCESS_KEY));
  },

  async getRefresh(): Promise<string | null> {
    return memoryTokens?.refreshToken ?? (await SecureStore.getItemAsync(REFRESH_KEY));
  },

  async clearPersisted(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    await SecureStore.deleteItemAsync(REMEMBER_KEY);
  },

  async clear(): Promise<void> {
    memoryTokens = null;
    await tokenStore.clearPersisted();
  },
};

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Ham cagri: zarfi (meta dahil) oldugu gibi dondurur. */
async function callRaw<T>(
  path: string,
  init: RequestInit,
  accessToken?: string | null,
): Promise<ApiSuccess<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  const body = (await res.json()) as ApiResponse<T>;
  if (!body.success) throw new ApiError(body.error.code, body.error.message);
  return body;
}

const call = async <T>(path: string, init: RequestInit, token?: string | null): Promise<T> =>
  (await callRaw<T>(path, init, token)).data;

/** Access token suresi dolduysa refresh rotasyonunu bir kez dener (§6.3). */
async function withRefresh<T>(run: (token: string | null) => Promise<T>): Promise<T> {
  const access = await tokenStore.getAccess();
  try {
    return await run(access);
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== 'UNAUTHORIZED') throw error;

    const refreshToken = await tokenStore.getRefresh();
    if (!refreshToken) throw error;

    const refreshed = await call<{ tokens: AuthTokens }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    await tokenStore.save(refreshed.tokens);
    return run(refreshed.tokens.accessToken);
  }
}

export const api = <T>(path: string, init: RequestInit = {}): Promise<T> =>
  withRefresh((token) => call<T>(path, init, token));

export const apiGet = <T>(path: string): Promise<T> => api<T>(path, { method: 'GET' });

/** Sayfali uclarda zarfin meta'si da lazim (§10) — sonsuz kaydirma bunu kullanir. */
export const apiGetPaged = <T>(path: string): Promise<{ data: T[]; meta: PaginationMeta }> =>
  withRefresh(async (token) => {
    const body = await callRaw<T[]>(path, { method: 'GET' }, token);
    return { data: body.data, meta: body.meta ?? { page: 1, limit: 20, total: body.data.length } };
  });

export const apiPost = <T>(path: string, payload: unknown): Promise<T> =>
  api<T>(path, { method: 'POST', body: JSON.stringify(payload) });

/** Giris/refresh oncesi token gerektirmeyen cagri. */
export const apiPublicPost = <T>(path: string, payload: unknown): Promise<T> =>
  call<T>(path, { method: 'POST', body: JSON.stringify(payload) });
