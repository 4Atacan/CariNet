import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createZodDto } from 'nestjs-zod';
import {
  UserRole,
  bulkConfirmSchema,
  cancelIntentSchema,
  confirmIntentSchema,
  createIntentSchema,
  guestIntentSchema,
  installmentQuerySchema,
  intentListQuerySchema,
} from '@carinet/shared';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { type RequestUser } from '../../common/types/request-with-user';
import { type UploadedFile as MulterFile } from '../imports/imports.service';
import { CollectionsService } from './collections.service';
import { StatementService } from './statement.service';

class CreateIntentDto extends createZodDto(createIntentSchema) {}
class GuestIntentDto extends createZodDto(guestIntentSchema) {}
class ConfirmIntentDto extends createZodDto(confirmIntentSchema) {}
class CancelIntentDto extends createZodDto(cancelIntentSchema) {}
class IntentListDto extends createZodDto(intentListQuerySchema) {}
class BulkConfirmDto extends createZodDto(bulkConfirmSchema) {}
class InstallmentDto extends createZodDto(installmentQuerySchema) {}

const SELLER = [UserRole.SELLER_ADMIN, UserRole.SELLER_STAFF] as const;

@ApiTags('collections')
@Controller('collections')
export class CollectionsController {
  constructor(
    private readonly collections: CollectionsService,
    private readonly statements: StatementService,
  ) {}

  // ---------------------------------------------------------------- misafir (§8)

  @Get('guest/:sellerSlug')
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Misafir odeme sayfasi basligi: satici + acik kanallar' })
  publicSeller(@Param('sellerSlug') slug: string) {
    return this.collections.publicSeller(slug);
  }

  @Post('guest/:sellerSlug')
  @Public()
  // §11.1 — misafir ucu: siki rate limit + Turnstile + var/yok sizdirmayan yanit.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Misafir odeme talebi olusturur (cari kodu ile)' })
  guestIntent(@Param('sellerSlug') slug: string, @Body() body: GuestIntentDto) {
    return this.collections.guestIntent(slug, body);
  }

  // ---------------------------------------------------------------- POS callback (§8 Kanal 2)

  @Post('pos-callback/:provider')
  @Public()
  @ApiOperation({ summary: 'Saglayici bildirimi — imza dogrulanmadan hicbir sey islenmez' })
  posCallback(
    @Param('provider') provider: string,
    @Body() body: unknown,
    @Ip() ip: string,
  ): Promise<unknown> {
    return this.collections.posCallback(provider, body, ip);
  }

  // ---------------------------------------------------------------- talep

  @Post('intents')
  @ApiOperation({ summary: 'Odeme talebi acar (havale referansi veya hosted 3D paketi)' })
  createIntent(@Body() body: CreateIntentDto, @CurrentUser() user: RequestUser) {
    return this.collections.createIntent(body, user);
  }

  @Get('intents')
  @ApiOperation({ summary: 'Tahsilat talepleri (panel: bekleyenler; alici: kendi talepleri)' })
  list(@Query() query: IntentListDto, @CurrentUser() user: RequestUser) {
    return this.collections.list(query, user);
  }

  @Get('intents/:id')
  @ApiOperation({ summary: 'Talep detayi + odeme yapilacak IBAN' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.collections.findOne(id, user);
  }

  @Post('intents/:id/confirm')
  @Roles(...SELLER)
  @ApiOperation({ summary: 'Manuel onay → CREDIT + bildirim + audit (idempotent)' })
  confirm(
    @Param('id') id: string,
    @Body() body: ConfirmIntentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.collections.confirm(id, body, user);
  }

  @Post('intents/:id/cancel')
  @ApiOperation({ summary: 'Talebi iptal eder (kural #4: silme yok)' })
  cancel(@Param('id') id: string, @Body() body: CancelIntentDto, @CurrentUser() user: RequestUser) {
    return this.collections.cancel(id, body, user);
  }

  @Post('intents/:id/pay')
  @ApiOperation({ summary: 'Kart kanali: saglayicinin hosted 3D sayfasina yonlendirme paketi' })
  startPayment(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.collections.startPayment(id, user);
  }

  @Get('installments')
  @ApiOperation({ summary: 'Guncel taksit secenekleri (tutar + istege bagli BIN)' })
  installments(@Query() query: InstallmentDto) {
    return this.collections.installments(query);
  }

  // ---------------------------------------------------------------- banka ekstresi (§8 Kanal 1)

  @Post('statement-import')
  @Roles(...SELLER)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Banka ekstresi (CSV/Excel) yukler → otomatik eslestirme onerisi' })
  importStatement(@UploadedFile() file: MulterFile, @CurrentUser() user: RequestUser) {
    return this.statements.import(file, user);
  }

  @Get('statement-import/:batchId')
  @Roles(...SELLER)
  @ApiOperation({ summary: 'Ekstre satirlari + eslestirme onerileri' })
  statementMatches(@Param('batchId') batchId: string) {
    return this.statements.matches(batchId);
  }

  @Post('statement-import/:batchId/confirm')
  @Roles(...SELLER)
  @ApiOperation({ summary: 'Toplu onay: eslesen satirlar CREDIT olur (satir bazinda idempotent)' })
  bulkConfirm(
    @Param('batchId') batchId: string,
    @Body() body: BulkConfirmDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.statements.bulkConfirm(batchId, body, user);
  }
}
