import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { UserRole, exchangeRateQuerySchema } from '@carinet/shared';
import { NoTenant, Roles } from '../../common/decorators';
import { ExchangeRatesService } from './exchange-rates.service';

class RateQueryDto extends createZodDto(exchangeRateQuerySchema) {}

/** Kurlar TENANT DISIDIR (global) → @NoTenant: satici baglami gerekmez. */
@ApiTags('exchange-rates')
@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly rates: ExchangeRatesService) {}

  @Get()
  @NoTenant()
  @ApiOperation({ summary: 'Kur listesi (tarih araligi / para birimi filtreli)' })
  list(@Query() query: RateQueryDto) {
    return this.rates.list(query);
  }

  @Get('latest')
  @NoTenant()
  @ApiOperation({ summary: 'Her para birimi icin en guncel kur (Kurlar ekrani)' })
  latest() {
    return this.rates.latest();
  }

  @Post('sync')
  @NoTenant()
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'TCMB kurlarini elle ceker (cron zaten gunluk calisir)' })
  sync() {
    return this.rates.sync();
  }
}
