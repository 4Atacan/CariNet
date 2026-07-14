import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { dateRangeQuerySchema } from '@carinet/shared';
import { CurrentUser } from '../../common/decorators';
import { type RequestUser } from '../../common/types/request-with-user';
import { LedgerService } from '../ledger/ledger.service';
import { PdfService } from './pdf.service';
import { ReportsService } from './reports.service';

class RiskQueryDto extends createZodDto(z.object({ buyerAccountId: z.string().optional() })) {}
class PeriodicQueryDto extends createZodDto(
  dateRangeQuerySchema.extend({ buyerAccountId: z.string().optional() }),
) {}
class StatementPdfQueryDto extends createZodDto(dateRangeQuerySchema) {}

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly ledger: LedgerService,
    private readonly pdf: PdfService,
  ) {}

  @Get('risk')
  @ApiOperation({ summary: 'Risk foyu: acik bakiye, vadesi gecen, yaslandirma, limit %' })
  risk(@Query() query: RiskQueryDto, @CurrentUser() user: RequestUser) {
    return this.reports.risk(user, query.buyerAccountId);
  }

  @Get('risk/:buyerAccountId')
  @ApiOperation({ summary: 'Tek carinin risk foyu + acik kalemler (FIFO)' })
  riskDetail(@Param('buyerAccountId') id: string, @CurrentUser() user: RequestUser) {
    return this.reports.riskDetail(id, user);
  }

  @Get('periodic-balance')
  @ApiOperation({ summary: 'Donemsel bakiye (aylik borc/alacak + kumulatif bakiye)' })
  periodic(@Query() query: PeriodicQueryDto, @CurrentUser() user: RequestUser) {
    return this.reports.periodicBalance(user, query);
  }

  @Get('average-due/:buyerAccountId')
  @ApiOperation({ summary: 'Ortalama vade (tutar agirlikli)' })
  averageDue(@Param('buyerAccountId') id: string, @CurrentUser() user: RequestUser) {
    return this.reports.averageDue(user, id);
  }

  /** Zarf DISINDA ham PDF doner (ResponseInterceptor'i bypass eder — Content-Type: application/pdf). */
  @Get('statement-pdf/:buyerAccountId')
  @ApiOperation({ summary: 'Ekstre PDF (pdfmake) — indir/paylas. "me" = alicinin kendi carisi.' })
  async statementPdf(
    @Param('buyerAccountId') param: string,
    @Query() query: StatementPdfQueryDto,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ): Promise<void> {
    // Mobil kendi cari id'sini tasimak zorunda kalmasin (JWT zaten baglami tasiyor).
    const id = param === 'me' ? (user.buyerAccountId ?? param) : param;
    const { detail, sellerName } = await this.reports.statementData(id, user);
    const { rows } = await this.ledger.statement(id, {
      from: query.from,
      to: query.to,
      skip: 0,
      take: 500, // PDF icin makul ust sinir
    });

    const buffer = await this.pdf.statement({
      sellerName,
      accountCode: detail.accountCode,
      title: detail.title,
      balance: detail.balance,
      overdue: detail.overdue,
      creditLimit: detail.creditLimit,
      from: query.from,
      to: query.to,
      lines: rows.slice().reverse(), // ekstre PDF'i eskiden yeniye okunur
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ekstre-${detail.accountCode}.pdf"`);
    res.send(buffer);
  }
}
