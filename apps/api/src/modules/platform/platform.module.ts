import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformRepository } from './platform.repository';
import { PlatformService } from './platform.service';

/** Platform yonetimi (§0: platform admin). AuditModule @Global — ayrica import edilmez. */
@Module({
  controllers: [PlatformController],
  providers: [PlatformService, PlatformRepository],
})
export class PlatformModule {}
