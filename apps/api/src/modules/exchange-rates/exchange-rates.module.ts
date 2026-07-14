import { Module } from '@nestjs/common';
import { ExchangeRatesController } from './exchange-rates.controller';
import { ExchangeRatesService } from './exchange-rates.service';
import { TcmbParser } from './tcmb.parser';

/** §13 Faz 4 — TCMB kur cronu + Kurlar ekrani (tenant disi, global tablo). */
@Module({
  controllers: [ExchangeRatesController],
  providers: [ExchangeRatesService, TcmbParser],
  exports: [ExchangeRatesService],
})
export class ExchangeRatesModule {}
