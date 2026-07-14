import { Module } from '@nestjs/common';
import { ImportsModule } from '../imports/imports.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CollectionsController } from './collections.controller';
import { CollectionsRepository } from './collections.repository';
import { CollectionsService } from './collections.service';
import { IntentExpiryTask } from './intent-expiry.task';
import { IntentFactory } from './intent-factory.service';
import { ReconciliationService } from './reconciliation.service';
import { StatementService } from './statement.service';
import { BankTransferProvider } from './providers/bank-transfer.provider';
import { CardPosProvider } from './providers/card-pos.provider';
import { PosRegistry } from './providers/pos/pos-registry.service';
import { SandboxPosAdapter } from './providers/pos/sandbox-pos.adapter';

/** §8 — iki kanal, tek hat. ImportsModule: ekstre dosyasi ExcelParser ile okunur. */
@Module({
  imports: [ImportsModule, NotificationsModule],
  controllers: [CollectionsController],
  providers: [
    CollectionsRepository,
    CollectionsService,
    StatementService,
    ReconciliationService,
    IntentFactory,
    BankTransferProvider,
    CardPosProvider,
    PosRegistry,
    SandboxPosAdapter,
    IntentExpiryTask,
  ],
  exports: [CollectionsRepository, PosRegistry],
})
export class CollectionsModule {}
