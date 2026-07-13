import { Injectable, type NestMiddleware } from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';
import { TenantContext } from '../tenant/tenant-context';

/**
 * Her istek icin bos bir tenant store acar. TenantGuard, JWT dogrulandiktan sonra
 * bu store'u doldurur; Prisma eklentisi ayni store'dan okur (§6.1).
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    TenantContext.run({}, () => next());
  }
}
