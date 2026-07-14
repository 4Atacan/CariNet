import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { UserRole, createRepresentativeSchema, updateRepresentativeSchema } from '@carinet/shared';
import { Roles } from '../../common/decorators';
import { RepresentativesService } from './representatives.service';

class CreateRepresentativeDto extends createZodDto(createRepresentativeSchema) {}
class UpdateRepresentativeDto extends createZodDto(updateRepresentativeSchema) {}

@ApiTags('representatives')
@Roles(UserRole.SELLER_ADMIN, UserRole.SELLER_STAFF)
@Controller('representatives')
export class RepresentativesController {
  constructor(private readonly representatives: RepresentativesService) {}

  @Get()
  @ApiOperation({ summary: 'Satis temsilcileri' })
  list() {
    return this.representatives.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Temsilci detayi' })
  findOne(@Param('id') id: string) {
    return this.representatives.findOne(id);
  }

  @Post()
  @Roles(UserRole.SELLER_ADMIN)
  @ApiOperation({ summary: 'Temsilci olustur' })
  create(@Body() dto: CreateRepresentativeDto) {
    return this.representatives.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SELLER_ADMIN)
  @ApiOperation({ summary: 'Temsilci guncelle' })
  update(@Param('id') id: string, @Body() dto: UpdateRepresentativeDto) {
    return this.representatives.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SELLER_ADMIN)
  @ApiOperation({ summary: 'Temsilci sil (finansal kayit degil — hard delete serbest)' })
  remove(@Param('id') id: string) {
    return this.representatives.remove(id);
  }
}
