import { Module } from '@nestjs/common';
import { RepresentativesController } from './representatives.controller';
import { RepresentativesRepository } from './representatives.repository';
import { RepresentativesService } from './representatives.service';

@Module({
  controllers: [RepresentativesController],
  providers: [RepresentativesRepository, RepresentativesService],
  exports: [RepresentativesRepository],
})
export class RepresentativesModule {}
