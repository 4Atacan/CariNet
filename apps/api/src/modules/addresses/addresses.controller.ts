import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { createAddressSchema, updateAddressSchema } from '@carinet/shared';
import { CurrentUser } from '../../common/decorators';
import { type RequestUser } from '../../common/types/request-with-user';
import { AddressesService } from './addresses.service';

class CreateAddressDto extends createZodDto(createAddressSchema) {}
class UpdateAddressDto extends createZodDto(updateAddressSchema) {}
class ListQueryDto extends createZodDto(z.object({ buyerAccountId: z.string().min(1) })) {}

@ApiTags('addresses')
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Carinin adresleri' })
  list(@Query() query: ListQueryDto, @CurrentUser() user: RequestUser) {
    return this.addresses.list(query.buyerAccountId, user);
  }

  @Post()
  @ApiOperation({ summary: 'Adres ekle' })
  create(@Body() dto: CreateAddressDto, @CurrentUser() user: RequestUser) {
    return this.addresses.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Adres guncelle' })
  update(@Param('id') id: string, @Body() dto: UpdateAddressDto, @CurrentUser() user: RequestUser) {
    return this.addresses.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Adres sil (finansal kayit degil)' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.addresses.remove(id, user);
  }
}
