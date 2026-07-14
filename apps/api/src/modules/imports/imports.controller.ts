import {
  Body,
  Controller,
  Get,
  Param,
  ParseFilePipeBuilder,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  UserRole,
  cancelImportSchema,
  commitImportSchema,
  importRowsQuerySchema,
  importUploadSchema,
  moneySchema,
  paginationQuerySchema,
  saveTemplateSchema,
} from '@carinet/shared';
import { CurrentUser, Roles } from '../../common/decorators';
import { type RequestUser } from '../../common/types/request-with-user';
import { ImportsService, type UploadedFile as ImportFile } from './imports.service';

class UploadDto extends createZodDto(importUploadSchema) {}
class CommitDto extends createZodDto(commitImportSchema) {}
class CancelDto extends createZodDto(cancelImportSchema) {}
class SaveTemplateDto extends createZodDto(saveTemplateSchema) {}
class RowsQueryDto extends createZodDto(importRowsQuerySchema) {}
class BatchesQueryDto extends createZodDto(paginationQuerySchema) {}
class ReportQueryDto extends createZodDto(z.object({ expectedTotal: moneySchema.optional() })) {}

/** 10 MB (§11.2). Uzanti + MIME kontrolu; magic-byte kontrolu ayristiricinin kendisidir. */
const filePipe = new ParseFilePipeBuilder()
  .addFileTypeValidator({
    fileType: /(xlsx|xls|xml|zip|spreadsheetml|excel|octet-stream|text\/xml)/i,
  })
  .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
  .build({ fileIsRequired: true });

@ApiTags('imports')
@Roles(UserRole.SELLER_ADMIN, UserRole.SELLER_STAFF)
@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ description: 'Excel/UBL dosyasi + hedef (§6.6)', type: UploadDto })
  @ApiOperation({ summary: 'Dosya yukle → ayristir → staging + onizleme (yazma YOK)' })
  upload(
    @UploadedFile(filePipe) file: ImportFile,
    @Body() dto: UploadDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.imports.upload(file, dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Yukleme gecmisi' })
  list(@Query() query: BatchesQueryDto) {
    return this.imports.listBatches(query);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Kaydedilmis kolon esleme sablonlari (§9)' })
  templates() {
    return this.imports.listTemplates();
  }

  @Post('templates')
  @ApiOperation({ summary: 'Onaylanan eslemeyi sablon olarak kaydet' })
  saveTemplate(@Body() dto: SaveTemplateDto) {
    return this.imports.saveTemplate(dto);
  }

  @Get(':id/rows')
  @ApiOperation({ summary: 'Staging satirlari (hata raporu: satir no + sebep)' })
  rows(@Param('id') id: string, @Query() query: RowsQueryDto) {
    return this.imports.batchRows(id, query);
  }

  @Get(':id/validation-report')
  @ApiOperation({ summary: 'Dogrulama Raporu (§9): program toplami ↔ bizim hesap' })
  report(@Param('id') id: string, @Query() query: ReportQueryDto) {
    return this.imports.validationReport(id, query.expectedTotal);
  }

  @Post(':id/commit')
  @ApiOperation({ summary: 'Onay → tek DB transaction ile commit' })
  commit(@Param('id') id: string, @Body() dto: CommitDto, @CurrentUser() user: RequestUser) {
    return this.imports.commit(id, dto, user);
  }

  @Roles(UserRole.SELLER_ADMIN)
  @Post(':id/cancel')
  @ApiOperation({ summary: 'Yuklemeyi iptal et (bagli kayitlara toplu is_cancelled)' })
  cancel(@Param('id') id: string, @Body() dto: CancelDto, @CurrentUser() user: RequestUser) {
    return this.imports.cancel(id, dto.reason, user);
  }
}
