import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RemittanceService } from './remittance.service.js';
import type { AcquireRemittanceRequest } from '../../generated/server/model/acquireRemittanceRequest.js';
import { acquireRemittanceSchema } from './remittance.schemas.js';

@ApiTags('remittance')
@Controller('remit/us')
export class RemittanceController {
  constructor(private readonly remittanceService: RemittanceService) {}

  @Post('acquire-qzd')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Simulate acquisition of QZD from incoming USD remittance.' })
  async acquire(@Body() dto: AcquireRemittanceRequest) {
    const payload = acquireRemittanceSchema.parse(dto);
    return this.remittanceService.acquire(payload);
  }
}
