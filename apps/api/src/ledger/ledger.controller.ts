import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LedgerService } from './ledger.service.js';
import { TransferDto, TransferSchema } from './dto/transfer.dto.js';
import { IssueDto, IssueSchema } from './dto/issue.dto.js';
import { RedeemDto, RedeemSchema } from './dto/redeem.dto.js';

@ApiTags('transactions')
@Controller('tx')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Post('transfer')
  @ApiOperation({ summary: 'Transfer QZD between accounts.' })
  async transfer(@Body() dto: TransferDto) {
    const payload = TransferSchema.parse(dto);
    return this.ledgerService.transfer(payload);
  }

  @Post('issue')
  @ApiOperation({ summary: 'Mint new QZD (admin multi-sig).' })
  async issue(@Body() dto: IssueDto) {
    const payload = IssueSchema.parse(dto);
    return this.ledgerService.issue(payload);
  }

  @Post('redeem')
  @ApiOperation({ summary: 'Redeem QZD for cash (bank/agent-only).' })
  async redeem(@Body() dto: RedeemDto) {
    const payload = RedeemSchema.parse(dto);
    return this.ledgerService.redeem(payload);
  }
}
