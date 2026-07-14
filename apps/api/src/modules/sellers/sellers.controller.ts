import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { UserRole, bankAccountSchema, posConfigSchema } from '@carinet/shared';
import { CurrentUser, Roles } from '../../common/decorators';
import { type RequestUser } from '../../common/types/request-with-user';
import { SellersService } from './sellers.service';

class BankAccountDto extends createZodDto(bankAccountSchema) {}
class PosConfigDto extends createZodDto(posConfigSchema) {}
/** Pasiflestirme de kritik islemdir → 2FA kodu query ile gelir. */
class TotpQueryDto extends createZodDto(z.object({ totp: z.string().length(6).optional() })) {}

@ApiTags('sellers')
@Controller('sellers')
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Satici profili' })
  profile(@CurrentUser() user: RequestUser) {
    return this.sellers.profile(user);
  }

  // ---------------------------------------------------------------- banka hesaplari (§8 Kanal 1)

  @Get('bank-accounts')
  @ApiOperation({ summary: 'Tahsilat IBAN listesi' })
  listBankAccounts() {
    return this.sellers.listBankAccounts();
  }

  @Post('bank-accounts')
  @Roles(UserRole.SELLER_ADMIN)
  @ApiOperation({ summary: 'IBAN ekler (kritik islem: 2FA + audit)' })
  createBankAccount(@Body() body: BankAccountDto, @CurrentUser() user: RequestUser) {
    return this.sellers.createBankAccount(body, user);
  }

  @Patch('bank-accounts/:id')
  @Roles(UserRole.SELLER_ADMIN)
  @ApiOperation({ summary: 'IBAN gunceller (kritik islem: 2FA + audit)' })
  updateBankAccount(
    @Param('id') id: string,
    @Body() body: BankAccountDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.sellers.updateBankAccount(id, body, user);
  }

  @Delete('bank-accounts/:id')
  @Roles(UserRole.SELLER_ADMIN)
  @ApiOperation({ summary: 'IBAN pasiflestirir (silme yok)' })
  deactivateBankAccount(
    @Param('id') id: string,
    @Query() query: TotpQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.sellers.deactivateBankAccount(id, query.totp, user);
  }

  // ---------------------------------------------------------------- POS (§8 Kanal 2)

  @Get('pos-providers')
  @Roles(UserRole.SELLER_ADMIN)
  @ApiOperation({ summary: 'Desteklenen POS saglayicilari' })
  providers() {
    return this.sellers.providers();
  }

  @Get('pos-config')
  @Roles(UserRole.SELLER_ADMIN)
  @ApiOperation({ summary: 'POS tanimi (anahtarlar MASKELI doner)' })
  posConfig() {
    return this.sellers.posConfig();
  }

  @Put('pos-config')
  @Roles(UserRole.SELLER_ADMIN)
  @ApiOperation({ summary: 'POS tanimini kaydeder (AES-256-GCM · 2FA + audit)' })
  savePosConfig(@Body() body: PosConfigDto, @CurrentUser() user: RequestUser) {
    return this.sellers.savePosConfig(body, user);
  }

  @Delete('pos-config')
  @Roles(UserRole.SELLER_ADMIN)
  @ApiOperation({ summary: 'POS tanimini pasiflestirir' })
  deactivatePosConfig(@Query() query: TotpQueryDto, @CurrentUser() user: RequestUser) {
    return this.sellers.deactivatePosConfig(query.totp, user);
  }
}
