import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { PdfService } from './pdf.service';
import { ReportsController } from './reports.controller';
import { ReportsRepository } from './reports.repository';
import { ReportsService } from './reports.service';

@Module({
  imports: [LedgerModule],
  controllers: [ReportsController],
  providers: [ReportsRepository, ReportsService, PdfService],
  /** Excel disa aktarma risk foyunu buradan alir (tek dogruluk kaynagi). */
  exports: [ReportsService],
})
export class ReportsModule {}
