import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { PRISMA, type PrismaService } from '../../prisma/prisma.module';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Servis ve veritabani canlilik kontrolu (UptimeRobot)' })
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', time: new Date().toISOString() };
  }
}
