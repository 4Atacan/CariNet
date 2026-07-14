import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  AppError,
  ErrorCode,
  UserRole,
  buyerListQuerySchema,
  createBuyerAccountSchema,
  dateRangeQuerySchema,
  paginationQuerySchema,
  updateBuyerAccountSchema,
} from '@carinet/shared';
import { CurrentUser, Roles } from '../../common/decorators';
import { type RequestUser } from '../../common/types/request-with-user';
import { BuyersService } from './buyers.service';

class ListBuyersQueryDto extends createZodDto(buyerListQuerySchema) {}
class CreateBuyerDto extends createZodDto(createBuyerAccountSchema) {}
class UpdateBuyerDto extends createZodDto(updateBuyerAccountSchema) {}
class StatementQueryDto extends createZodDto(paginationQuerySchema.merge(dateRangeQuerySchema)) {}
class SetActiveDto extends createZodDto(z.object({ isActive: z.boolean() })) {}

const SELLER_SIDE = [UserRole.SELLER_ADMIN, UserRole.SELLER_STAFF] as const;

@ApiTags('buyers')
@Controller('buyers')
export class BuyersController {
  constructor(private readonly buyers: BuyersService) {}

  @Roles(...SELLER_SIDE)
  @Get()
  @ApiOperation({ summary: 'Cari hesaplar (sayfali, canli bakiyeli)' })
  list(@Query() query: ListBuyersQueryDto) {
    return this.buyers.list(query);
  }

  /** Mobil Dashboard — ':id' rotasindan ONCE tanimlanmali. */
  @Roles(UserRole.BUYER_USER)
  @Get('me')
  @ApiOperation({ summary: 'Alicinin kendi carisi: bakiye, limit, temsilci, son 10 hareket' })
  me(@CurrentUser() user: RequestUser) {
    return this.buyers.dashboard(user);
  }

  /** Mobil ekstre — ':id/statement' rotasindan ONCE tanimlanmali. */
  @Roles(UserRole.BUYER_USER)
  @Get('me/statement')
  @ApiOperation({ summary: 'Alicinin kendi ekstresi (yuruyen bakiye)' })
  myStatement(@Query() query: StatementQueryDto, @CurrentUser() user: RequestUser) {
    if (!user.buyerAccountId) throw new AppError(ErrorCode.TENANT_FORBIDDEN);
    return this.buyers.statement(user.buyerAccountId, user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Cari hesap detayi (bakiye dahil)' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.buyers.findOne(id, user);
  }

  @Get(':id/statement')
  @ApiOperation({ summary: 'Ekstre — yuruyen bakiye ile (§6.4)' })
  statement(
    @Param('id') id: string,
    @Query() query: StatementQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.buyers.statement(id, user, query);
  }

  @Get(':id/code-history')
  @ApiOperation({ summary: 'Cari kodu degisim tarihcesi' })
  codeHistory(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.buyers.codeHistory(id, user);
  }

  @Roles(...SELLER_SIDE)
  @Post()
  @ApiOperation({ summary: 'Cari hesap olustur' })
  create(@Body() dto: CreateBuyerDto) {
    return this.buyers.create(dto);
  }

  @Roles(...SELLER_SIDE)
  @Patch(':id')
  @ApiOperation({ summary: 'Cari hesap guncelle (kod degisimi tarihceye yazilir)' })
  update(@Param('id') id: string, @Body() dto: UpdateBuyerDto) {
    return this.buyers.update(id, dto);
  }

  /** Kural #4: silme YOK — pasife alma var. */
  @Roles(UserRole.SELLER_ADMIN)
  @Patch(':id/active')
  @ApiOperation({ summary: 'Cari hesabi aktif/pasif yap (silme yoktur)' })
  setActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.buyers.setActive(id, dto.isActive);
  }
}
