import { Module } from '@nestjs/common';
import { CollectionsModule } from '../collections/collections.module';
import { SellersController } from './sellers.controller';
import { SellersRepository } from './sellers.repository';
import { SellersService } from './sellers.service';

/** Satici ayarlari: tahsilat IBAN'lari + kendi POS'u (§8). CollectionsModule: PosRegistry. */
@Module({
  imports: [CollectionsModule],
  controllers: [SellersController],
  providers: [SellersRepository, SellersService],
})
export class SellersModule {}
