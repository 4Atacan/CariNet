import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import {
  UserRole,
  cancelInvoiceSchema,
  createInvoiceSchema,
  invoiceListQuerySchema,
} from '@carinet/shared';
import { CurrentUser, Roles } from '../../common/decorators';
import { type RequestUser } from '../../common/types/request-with-user';
import { InvoicesService } from './invoices.service';

class ListInvoicesQueryDto extends createZodDto(invoiceListQuerySchema) {}
class CreateInvoiceDto extends createZodDto(createInvoiceSchema) {}
class CancelInvoiceDto extends createZodDto(cancelInvoiceSchema) {}

@ApiTags('invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'Faturalar (sayfali; alici yalniz kendi faturalarini gorur)' })
  list(@Query() query: ListInvoicesQueryDto, @CurrentUser() user: RequestUser) {
    return this.invoices.list(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fatura detayi (kalemler + satir bazli kur)' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.invoices.findOne(id, user);
  }

  @Roles(UserRole.SELLER_ADMIN, UserRole.SELLER_STAFF)
  @Post()
  @ApiOperation({ summary: 'Fatura olustur (kalemler + otomatik DEBIT hareketi)' })
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: RequestUser) {
    return this.invoices.create(dto, user);
  }

  @Roles(UserRole.SELLER_ADMIN)
  @Post(':id/cancel')
  @ApiOperation({ summary: 'Faturayi iptal et (bagli hareket de iptal olur)' })
  cancel(@Param('id') id: string, @Body() dto: CancelInvoiceDto, @CurrentUser() user: RequestUser) {
    return this.invoices.cancel(id, dto.reason, user);
  }
}
