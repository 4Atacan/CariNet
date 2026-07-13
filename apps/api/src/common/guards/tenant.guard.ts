import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError, ErrorCode, UserRole } from '@carinet/shared';
import { IS_PUBLIC_KEY, IS_REFRESH_KEY, NO_TENANT_KEY } from '../decorators';
import { TenantContext } from '../tenant/tenant-context';
import { type RequestWithUser } from '../types/request-with-user';

/**
 * CLAUDE.md kural #3 / §6.1 — uclu hattin 2. kemeri.
 * JWT'deki sellerId'yi istek baglamina yazar. PLATFORM_ADMIN disinda sellerId'siz
 * (yani tenant baglami olmayan) bir istek korunan uclara giremez.
 */
@Injectable()
export class TenantGuard implements CanActivate {
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

    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    if (!user) throw new AppError(ErrorCode.UNAUTHORIZED);

    const store = TenantContext.get();
    store.userId = user.userId;
    store.role = user.role;
    store.sellerId = user.sellerId;
    store.buyerAccountId = user.buyerAccountId;
    // Platform admin tenant ustudur; tenant filtresini kendisi secer (§6.1).
    store.system = user.role === UserRole.PLATFORM_ADMIN;

    const noTenant = this.reflector.getAllAndOverride<boolean>(NO_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (noTenant || store.system) return true;

    if (!user.sellerId) {
      throw new AppError(ErrorCode.TENANT_FORBIDDEN, 'Istek bir satici baglami tasimiyor.');
    }
    return true;
  }
}
