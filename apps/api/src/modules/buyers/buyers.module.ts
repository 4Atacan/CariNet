import { Module } from '@nestjs/common';
import { BuyersController } from './buyers.controller';
import { BuyersRepository } from './buyers.repository';
import { BuyersService } from './buyers.service';

@Module({
  controllers: [BuyersController],
  providers: [BuyersService, BuyersRepository],
})
export class BuyersModule {}
