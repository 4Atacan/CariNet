import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { ImportsController } from './imports.controller';
import { ImportsRepository } from './imports.repository';
import { ImportsService } from './imports.service';
import { ExcelParser } from './parsers/excel.parser';
import { UblParser } from './parsers/ubl.parser';

@Module({
  imports: [StorageModule],
  controllers: [ImportsController],
  providers: [ImportsRepository, ImportsService, ExcelParser, UblParser],
  /** Banka ekstresi de ayni ayristiriciyi kullanir (§8 Kanal 1). */
  exports: [ExcelParser],
})
export class ImportsModule {}
