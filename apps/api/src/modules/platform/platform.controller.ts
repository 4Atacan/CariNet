import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { UserRole, createSellerSchema, setSellerActiveSchema } from '@carinet/shared';
import { CurrentUser, NoTenant, Roles } from '../../common/decorators';
import { type RequestUser } from '../../common/types/request-with-user';
import { PlatformService } from './platform.service';

class CreateSellerDto extends createZodDto(createSellerSchema) {}
class SetSellerActiveDto extends createZodDto(setSellerActiveSchema) {}

/**
 * Platform yonetimi. TAMAMI PLATFORM_ADMIN'e kapali ve `@NoTenant`:
 * platform admininin uyeligi yoktur, dolayisiyla jetonunda sellerId tasimaz.
 *
 * Kapsam bilincli olarak DAR: yalnizca satici koku (liste / olustur / aktiflik) ve bekleyen
 * davetler. Tenant ICI veriye (cari, hareket, fatura) buradan erisim YOKTUR — aksi halde
 * kural #3'un izolasyonu tek bir rolun arkasinda erirdi.
 */
@ApiTags('platform')
@Controller('platform')
@Roles(UserRole.PLATFORM_ADMIN)
@NoTenant()
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('sellers')
  @ApiOperation({ summary: 'Satici listesi (uye ve cari sayilariyla)' })
  listSellers() {
    return this.platform.listSellers();
  }

  @Post('sellers')
  @ApiOperation({ summary: 'Yeni satici olustur (tenant koku)' })
  createSeller(@CurrentUser() user: RequestUser, @Body() dto: CreateSellerDto) {
    return this.platform.createSeller(dto, user.userId);
  }

  @Patch('sellers/:id/active')
  @ApiOperation({ summary: 'Saticiyi aktif/pasif yap (§6.2 — pasifte alicilar salt-okunur)' })
  setActive(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SetSellerActiveDto,
  ) {
    return this.platform.setSellerActive(id, dto.isActive, user.userId);
  }

  @Get('sellers/:id/invites')
  @ApiOperation({ summary: 'Saticinin bekleyen yonetici davetleri' })
  openInvites(@Param('id') id: string) {
    return this.platform.listOpenInvites(id);
  }
}
