import { type ApiResponse, type ApiSuccess, type PaginationMeta } from '@carinet/shared';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface Paged<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Kural #9: panel tokenlari httpOnly cookie'de tutar → `credentials: 'include'`.
 * Token'a JS'ten ERISILMEZ; localStorage'a hicbir sey yazilmaz.
 */
async function request<T>(path: string, init?: RequestInit): Promise<ApiSuccess<T>> {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });

  const body = (await res.json()) as ApiResponse<T>;
  if (!body.success) {
    throw new ApiError(body.error.code, body.error.message, body.error.details);
  }
  return body;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const body = await request<T>(path, init);
  return body.data;
}

export const apiGet = <T>(path: string): Promise<T> => api<T>(path, { method: 'GET' });

/** Sayfali uclar: zarfin meta'si da lazim (§10). */
export async function apiGetPaged<T>(path: string): Promise<Paged<T>> {
  const body = await request<T[]>(path);
  const fallback: PaginationMeta = { page: 1, limit: 20, total: body.data.length };
  return { data: body.data, meta: body.meta ?? fallback };
}

export const apiPost = <T>(path: string, payload: unknown): Promise<T> =>
  api<T>(path, { method: 'POST', body: JSON.stringify(payload) });

export const apiPatch = <T>(path: string, payload: unknown): Promise<T> =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(payload) });

export const apiPut = <T>(path: string, payload: unknown): Promise<T> =>
  api<T>(path, { method: 'PUT', body: JSON.stringify(payload) });

export const apiDelete = <T>(path: string): Promise<T> => api<T>(path, { method: 'DELETE' });

/** Import: multipart (Content-Type'i tarayici sinir dizesiyle kendisi koyar). */
export const apiUpload = <T>(path: string, form: FormData): Promise<T> =>
  api<T>(path, { method: 'POST', body: form });

/** PDF gibi ham ikili yanitlar zarf DISINDA doner (§10 istisnasi). */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await fetch(`${BASE_URL}${path}`, { credentials: 'include' });
  if (!res.ok) {
    throw new ApiError('INTERNAL_ERROR', 'Dosya olusturulamadi');
  }
  return res.blob();
}

export const qs = (params: Record<string, string | number | boolean | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};
