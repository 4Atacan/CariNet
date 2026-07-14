import { Module } from '@nestjs/common';
import { BuyersModule } from '../buyers/buyers.module';
import { LedgerModule } from '../ledger/ledger.module';
import { ProductsModule } from '../products/products.module';
import { ReportsModule } from '../reports/reports.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

/** §13 Faz 4 — Excel disa aktarma. Veriyi mevcut servislerden alir (tek dogruluk kaynagi). */
@Module({
  imports: [BuyersModule, LedgerModule, ProductsModule, ReportsModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
