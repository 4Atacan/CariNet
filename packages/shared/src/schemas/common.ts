import { z } from 'zod';

/** CLAUDE.md §10 — sayfalama: ?page=&limit= (vars. 20, maks 100) */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Ekstre / rapor tarih araligi. ISO 8601 UTC. */
export const dateRangeQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

export const cuidSchema = z.string().cuid2().or(z.string().cuid());

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

/** Basarili yanit zarfi (§10) */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/** Hatali yanit zarfi (§10) */
export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const paginate = (page: number, limit: number) => ({
  skip: (page - 1) * limit,
  take: limit,
});
