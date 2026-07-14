import { Module } from '@nestjs/common';
import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';

/**
 * Bakiye/ekstre turetiminin tek kaynagi (kural #2). Kendi controller'i YOKTUR —
 * buyers / transactions / invoices / reports modulleri bu servisi kullanir.
 */
@Module({
  providers: [LedgerRepository, LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
