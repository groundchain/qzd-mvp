import { Module } from '@nestjs/common';
import { LedgerController } from './ledger.controller.js';
import { LedgerService } from './ledger.service.js';

@Module({
  controllers: [LedgerController],
  providers: [LedgerService]
})
export class LedgerModule {}
