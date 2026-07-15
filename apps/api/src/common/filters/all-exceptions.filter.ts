import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ZodValidationException } from 'nestjs-zod';
import * as Sentry from '@sentry/node';
import { type Response } from 'express';
import { AppError, ERROR_MESSAGES, ErrorCode, type ApiFailure } from '@carinet/shared';
import { sentryEnabled } from '../../instrument';

/**
 * CLAUDE.md §10 + §11.2 — tek tip hata zarfi; ic detay (stack, SQL, dosya yolu) SIZDIRILMAZ.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toFailure(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Bilinmeyen hata',
        exception instanceof Error ? exception.stack : undefined,
      );
      // §11.8 — beklenmeyen 5xx'ler Sentry'ye (DSN yoksa no-op). 4xx is kurali, gonderilmez.
      if (sentryEnabled) Sentry.captureException(exception);
    }

    res.status(status).json(body);
  }

  private toFailure(exception: unknown): { status: number; body: ApiFailure } {
    if (exception instanceof AppError) {
      return {
        status: exception.status,
        body: {
          success: false,
          error: { code: exception.code, message: exception.message, details: exception.details },
        },
      };
    }

    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError();
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: ERROR_MESSAGES.VALIDATION_ERROR,
            details: zodError.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return this.simple(ErrorCode.CONFLICT);
      }
      if (exception.code === 'P2025') {
        return this.simple(ErrorCode.NOT_FOUND);
      }
      // Diger Prisma hatalarinin detayi sizdirilmaz.
      return this.simple(ErrorCode.INTERNAL_ERROR);
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = HTTP_TO_CODE[status] ?? ErrorCode.INTERNAL_ERROR;
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string }).message ?? ERROR_MESSAGES[code]);
      return {
        status,
        body: { success: false, error: { code, message: ERROR_MESSAGES[code] ?? message } },
      };
    }

    return this.simple(ErrorCode.INTERNAL_ERROR);
  }

  private simple(code: ErrorCode): { status: number; body: ApiFailure } {
    const err = new AppError(code);
    return {
      status: err.status,
      body: { success: false, error: { code, message: err.message } },
    };
  }
}

const HTTP_TO_CODE: Record<number, ErrorCode> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_ERROR,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
  [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorCode.INTERNAL_ERROR,
};
