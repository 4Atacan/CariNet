import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { exportQuerySchema } from '@carinet/shared';
import { CurrentUser } from '../../common/decorators';
import { type RequestUser } from '../../common/types/request-with-user';
import { ExportsService } from './exports.service';

class ExportDto extends createZodDto(exportQuerySchema) {}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('exports')
@Controller('exports')
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  /** Zarf DISINDA ham ikili doner (§10 istisnasi — PDF ile ayni desen). */
  @Get()
  @ApiOperation({ summary: 'Excel disa aktarma (CSV injection korumali — §11.3)' })
  async download(
    @Query() query: ExportDto,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, fileName } = await this.exports.build(query, user);

    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }
}
