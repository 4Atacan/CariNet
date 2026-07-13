import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError, ErrorCode, type UserRole } from '@carinet/shared';
import { IS_PUBLIC_KEY, IS_REFRESH_KEY, ROLES_KEY } from '../decorators';
import { type RequestWithUser } from '../types/request-with-user';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isRefresh = this.reflector.getAllAndOverride<boolean>(IS_REFRESH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || isRefresh) return true;

    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    if (!user) throw new AppError(ErrorCode.UNAUTHORIZED);
    if (!required.includes(user.role)) throw new AppError(ErrorCode.FORBIDDEN);
    return true;
  }
}
