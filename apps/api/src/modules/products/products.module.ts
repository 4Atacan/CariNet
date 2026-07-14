import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

/** §13 Faz 4 — urunler + stoklar (panel CRUD, mobil vitrin). */
@Module({
  controllers: [ProductsController],
  providers: [ProductsRepository, ProductsService],
  /** Excel disa aktarma urun listesini buradan alir. */
  exports: [ProductsService],
})
export class ProductsModule {}
