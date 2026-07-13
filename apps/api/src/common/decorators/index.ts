import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type UserRole } from '@carinet/shared';
import { type RequestWithUser, type RequestUser } from '../types/request-with-user';

/** Kimlik dogrulamasi gerektirmeyen uc (login, misafir odeme, health...). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Refresh ucu: access token degil, refresh token ile korunur. */
export const IS_REFRESH_KEY = 'isRefresh';
export const RefreshRoute = () => SetMetadata(IS_REFRESH_KEY, true);

/** Tenant baglami (sellerId) gerektirmeyen kimlikli uc: /auth/me, /auth/switch-account. */
export const NO_TENANT_KEY = 'noTenant';
export const NoTenant = () => SetMetadata(NO_TENANT_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (field: keyof RequestUser | undefined, ctx: ExecutionContext): RequestUser | unknown => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);
