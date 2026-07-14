import { Module } from '@nestjs/common';
import { BuyersModule } from '../buyers/buyers.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesRepository } from './invoices.repository';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [BuyersModule, TransactionsModule],
  controllers: [InvoicesController],
  providers: [InvoicesRepository, InvoicesService],
})
export class InvoicesModule {}
