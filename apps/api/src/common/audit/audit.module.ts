import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** Her modul finansal degisimde audit yazar (kural #4) → global. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
