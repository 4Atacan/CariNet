import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, map } from 'rxjs';
import { type ApiSuccess } from '@carinet/shared';
import { Paginated } from '../dto/paginated';

/** CLAUDE.md §10 — { success: true, data, meta? } zarfi. */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<unknown>> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<unknown>> {
    return next.handle().pipe(
      map((payload): ApiSuccess<unknown> => {
        if (payload instanceof Paginated) {
          return { success: true, data: payload.data, meta: payload.meta };
        }
        return { success: true, data: payload ?? null };
      }),
    );
  }
}
