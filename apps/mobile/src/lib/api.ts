import * as SecureStore from 'expo-secure-store';
import { type ApiResponse, type AuthTokens } from '@carinet/shared';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

/** Kural #9: mobil tokenlari expo-secure-store'da tutar. AsyncStorage/localStorage YASAK. */
const ACCESS_KEY = 'carinet.access';
const REFRESH_KEY = 'carinet.refresh';

export const tokenStore = {
  async save(tokens: AuthTokens): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
  },
  getAccess: () => SecureStore.getItemAsync(ACCESS_KEY),
  getRefresh: () => SecureStore.getItemAsync(REFRESH_KEY),
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
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

async function call<T>(path: string, init: RequestInit, accessToken?: string | null): Promise<T> {
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
  return body.data;
}

/** Access token suresi dolduysa refresh rotasyonunu bir kez dener (§6.3). */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const access = await tokenStore.getAccess();
  try {
    return await call<T>(path, init, access);
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== 'UNAUTHORIZED') throw error;

    const refreshToken = await tokenStore.getRefresh();
    if (!refreshToken) throw error;

    const refreshed = await call<{ tokens: AuthTokens }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    await tokenStore.save(refreshed.tokens);
    return call<T>(path, init, refreshed.tokens.accessToken);
  }
}

export const apiGet = <T>(path: string): Promise<T> => api<T>(path, { method: 'GET' });
export const apiPost = <T>(path: string, payload: unknown): Promise<T> =>
  api<T>(path, { method: 'POST', body: JSON.stringify(payload) });

/** Giris/refresh oncesi token gerektirmeyen cagri. */
export const apiPublicPost = <T>(path: string, payload: unknown): Promise<T> =>
  call<T>(path, { method: 'POST', body: JSON.stringify(payload) });
