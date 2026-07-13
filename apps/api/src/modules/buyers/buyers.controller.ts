import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { UserRole, paginationQuerySchema } from '@carinet/shared';
import { CurrentUser, Roles } from '../../common/decorators';
import { type RequestUser } from '../../common/types/request-with-user';
import { BuyersService } from './buyers.service';

class ListBuyersQueryDto extends createZodDto(paginationQuerySchema) {}

/** Faz 0: yalniz okuma — tenant izolasyonunun kanit zemini. Tam CRUD Faz 1'de. */
@ApiTags('buyers')
@Controller('buyers')
export class BuyersController {
  constructor(private readonly buyers: BuyersService) {}

  @Roles(UserRole.SELLER_ADMIN, UserRole.SELLER_STAFF)
  @Get()
  @ApiOperation({ summary: 'Saticinin cari hesaplari (sayfali)' })
  list(@Query() query: ListBuyersQueryDto) {
    return this.buyers.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Cari hesap detayi' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.buyers.findOne(id, user);
  }
}
