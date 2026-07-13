import { type ApiResponse } from '@carinet/shared';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Kural #9: panel tokenlari httpOnly cookie'de tutar → `credentials: 'include'`.
 * Token'a JS'ten ERISILMEZ; localStorage'a hicbir sey yazilmaz.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  const body = (await res.json()) as ApiResponse<T>;

  if (!body.success) {
    throw new ApiError(body.error.code, body.error.message);
  }
  return body.data;
}

export const apiPost = <T>(path: string, payload: unknown): Promise<T> =>
  api<T>(path, { method: 'POST', body: JSON.stringify(payload) });

export const apiGet = <T>(path: string): Promise<T> => api<T>(path, { method: 'GET' });
