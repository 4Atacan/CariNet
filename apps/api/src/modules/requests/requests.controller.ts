import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import {
  UserRole,
  createRequestSchema,
  replyRequestSchema,
  requestListQuerySchema,
} from '@carinet/shared';
import { CurrentUser, Roles } from '../../common/decorators';
import { type RequestUser } from '../../common/types/request-with-user';
import { RequestsService } from './requests.service';

class CreateRequestDto extends createZodDto(createRequestSchema) {}
class ReplyRequestDto extends createZodDto(replyRequestSchema) {}
class RequestListDto extends createZodDto(requestListQuerySchema) {}

const SELLER = [UserRole.SELLER_ADMIN, UserRole.SELLER_STAFF] as const;

@ApiTags('requests')
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Talep-oneri listesi (alici: yalniz kendi carisininkiler)' })
  list(@Query() query: RequestListDto, @CurrentUser() user: RequestUser) {
    return this.requests.list(query, user);
  }

  @Post()
  @Roles(UserRole.BUYER_USER)
  @ApiOperation({ summary: 'Alici talep/oneri acar (devir itirazi dahil)' })
  create(@Body() body: CreateRequestDto, @CurrentUser() user: RequestUser) {
    return this.requests.create(body, user);
  }

  @Post(':id/reply')
  @Roles(...SELLER)
  @ApiOperation({ summary: 'Satici yanitlar → aliciya bildirim + push' })
  reply(@Param('id') id: string, @Body() body: ReplyRequestDto, @CurrentUser() user: RequestUser) {
    return this.requests.reply(id, body, user);
  }

  @Post(':id/close')
  @Roles(...SELLER)
  @ApiOperation({ summary: 'Talebi kapatir (kayit silinmez)' })
  close(@Param('id') id: string) {
    return this.requests.close(id);
  }
}
