import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  UserRole,
  createProductSchema,
  productListQuerySchema,
  setStockSchema,
  updateProductSchema,
} from '@carinet/shared';
import { CurrentUser, Roles } from '../../common/decorators';
import { type RequestUser } from '../../common/types/request-with-user';
import { ProductsService } from './products.service';

class CreateProductDto extends createZodDto(createProductSchema) {}
class UpdateProductDto extends createZodDto(updateProductSchema) {}
class SetStockDto extends createZodDto(setStockSchema) {}
class ProductListDto extends createZodDto(productListQuerySchema) {}
class SetActiveDto extends createZodDto(z.object({ isActive: z.boolean() })) {}

const SELLER = [UserRole.SELLER_ADMIN, UserRole.SELLER_STAFF] as const;

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Urun listesi (alici: yalniz aktif urunler = vitrin)' })
  list(@Query() query: ProductListDto, @CurrentUser() user: RequestUser) {
    return this.products.list(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Urun detayi' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.products.findOne(id, user);
  }

  @Post()
  @Roles(...SELLER)
  @ApiOperation({ summary: 'Urun olusturur (acilis stogu ile birlikte)' })
  create(@Body() body: CreateProductDto) {
    return this.products.create(body);
  }

  @Patch(':id')
  @Roles(...SELLER)
  @ApiOperation({ summary: 'Urun gunceller' })
  update(@Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.products.update(id, body);
  }

  @Patch(':id/active')
  @Roles(...SELLER)
  @ApiOperation({ summary: 'Urunu vitrinden kaldirir/geri koyar (silme yok)' })
  setActive(@Param('id') id: string, @Body() body: SetActiveDto) {
    return this.products.setActive(id, body.isActive);
  }

  @Patch(':id/stock')
  @Roles(...SELLER)
  @ApiOperation({ summary: 'Stok miktarini MUTLAK olarak yazar (sayim sonucu)' })
  setStock(@Param('id') id: string, @Body() body: SetStockDto) {
    return this.products.setStock(id, body);
  }
}
