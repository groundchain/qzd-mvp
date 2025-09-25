import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RemittanceService } from './remittance.service.js';
import { AcquireRemittanceDto, AcquireRemittanceSchema } from './dto/acquire-remittance.dto.js';

@ApiTags('remittance')
@Controller('remit/us')
export class RemittanceController {
  constructor(private readonly remittanceService: RemittanceService) {}

  @Post('acquire-qzd')
  @ApiOperation({ summary: 'Simulate acquisition of QZD from incoming USD remittance.' })
  async acquire(@Body() dto: AcquireRemittanceDto) {
    const payload = AcquireRemittanceSchema.parse(dto);
    return this.remittanceService.acquire(payload);
  }
}
