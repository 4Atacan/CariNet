import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import {
  UserRole,
  cancelTransactionSchema,
  createTransactionSchema,
  transactionListQuerySchema,
} from '@carinet/shared';
import { CurrentUser, Roles } from '../../common/decorators';
import { type RequestUser } from '../../common/types/request-with-user';
import { TransactionsService } from './transactions.service';

class ListTransactionsQueryDto extends createZodDto(transactionListQuerySchema) {}
class CreateTransactionDto extends createZodDto(createTransactionSchema) {}
class CancelTransactionDto extends createZodDto(cancelTransactionSchema) {}

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Hareketler (sayfali; alici yalniz kendi carisini gorur)' })
  list(@Query() query: ListTransactionsQueryDto, @CurrentUser() user: RequestUser) {
    return this.transactions.list(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Hareket detayi' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.transactions.findOne(id, user);
  }

  @Roles(UserRole.SELLER_ADMIN, UserRole.SELLER_STAFF)
  @Post()
  @ApiOperation({ summary: 'Hareket girisi (borc/alacak)' })
  create(@Body() dto: CreateTransactionDto, @CurrentUser() user: RequestUser) {
    return this.transactions.create(dto, user);
  }

  @Roles(UserRole.SELLER_ADMIN)
  @Post(':id/cancel')
  @ApiOperation({ summary: 'Hareketi iptal et (kural #4: silme yok, ters etki)' })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelTransactionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.transactions.cancel(id, dto.reason, user);
  }
}
