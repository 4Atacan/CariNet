import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AppError, ErrorCode } from '@carinet/shared';
import { IS_PUBLIC_KEY, IS_REFRESH_KEY } from '../decorators';

/** Global kimlik kapisi. @Public() ve @RefreshRoute() disinda her uc access token ister. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const skip = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isRefresh = this.reflector.getAllAndOverride<boolean>(IS_REFRESH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip || isRefresh) return true;
    return super.canActivate(context);
  }

  override handleRequest<TUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw err instanceof AppError ? err : new AppError(ErrorCode.UNAUTHORIZED);
    }
    return user;
  }
}
