import { Module } from '@nestjs/common';
import { BuyersModule } from '../buyers/buyers.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsRepository } from './transactions.repository';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [BuyersModule],
  controllers: [TransactionsController],
  providers: [TransactionsRepository, TransactionsService],
  exports: [TransactionsRepository],
})
export class TransactionsModule {}
