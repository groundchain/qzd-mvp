import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { ValidatorsController } from './validators.controller.js';

@Module({
  controllers: [ValidatorsController],
  providers: [AdminService]
})
export class AdminModule {}
