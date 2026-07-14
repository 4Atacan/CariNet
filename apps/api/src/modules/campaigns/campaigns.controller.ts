import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import {
  UserRole,
  announceCampaignSchema,
  campaignListQuerySchema,
  createCampaignSchema,
} from '@carinet/shared';
import { CurrentUser, Roles } from '../../common/decorators';
import { type RequestUser } from '../../common/types/request-with-user';
import { CampaignsService } from './campaigns.service';

class CreateCampaignDto extends createZodDto(createCampaignSchema) {}
class CampaignListDto extends createZodDto(campaignListQuerySchema) {}
class AnnounceDto extends createZodDto(announceCampaignSchema) {}

const SELLER = [UserRole.SELLER_ADMIN, UserRole.SELLER_STAFF] as const;

@ApiTags('campaigns')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'Kampanyalar (alici: yalniz yayinda olanlar)' })
  list(@Query() query: CampaignListDto, @CurrentUser() user: RequestUser) {
    return this.campaigns.list(query, user);
  }

  @Post()
  @Roles(...SELLER)
  @ApiOperation({ summary: 'Kampanya olusturur' })
  create(@Body() body: CreateCampaignDto) {
    return this.campaigns.create(body);
  }

  @Delete(':id')
  @Roles(...SELLER)
  @ApiOperation({ summary: 'Kampanyayi siler (finansal kayit degildir)' })
  remove(@Param('id') id: string) {
    return this.campaigns.remove(id);
  }

  @Post(':id/announce')
  @Roles(...SELLER)
  @ApiOperation({ summary: 'Kampanyayi alicilara push"lar (payload hesap baglamli)' })
  announce(@Param('id') id: string, @Body() body: AnnounceDto, @CurrentUser() user: RequestUser) {
    return this.campaigns.announce(id, body, user);
  }
}
