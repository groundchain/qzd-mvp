import { Module } from '@nestjs/common';
import { RemittanceController } from './remittance.controller.js';
import { RemittanceService } from './remittance.service.js';

@Module({
  controllers: [RemittanceController],
  providers: [RemittanceService]
})
export class RemittanceModule {}
