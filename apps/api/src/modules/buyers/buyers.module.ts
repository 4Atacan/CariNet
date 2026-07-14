import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { BuyersController } from './buyers.controller';
import { BuyersRepository } from './buyers.repository';
import { BuyersService } from './buyers.service';

@Module({
  imports: [LedgerModule],
  controllers: [BuyersController],
  providers: [BuyersService, BuyersRepository],
  exports: [BuyersService, BuyersRepository],
})
export class BuyersModule {}
