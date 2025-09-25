import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LedgerService } from './ledger.service.js';
import type { TransferRequest } from '../../generated/server/model/transferRequest.js';
import type { IssueRequest } from '../../generated/server/model/issueRequest.js';
import type { RedeemRequest } from '../../generated/server/model/redeemRequest.js';
import { transferSchema, issueSchema, redeemSchema } from './ledger.schemas.js';

@ApiTags('transactions')
@Controller('tx')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Post('transfer')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Transfer QZD between accounts.' })
  async transfer(@Body() dto: TransferRequest) {
    const payload = transferSchema.parse(dto);
    return this.ledgerService.transfer(payload);
  }

  @Post('issue')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Mint new QZD (admin multi-sig).' })
  async issue(@Body() dto: IssueRequest) {
    const payload = issueSchema.parse(dto);
    return this.ledgerService.issue(payload);
  }

  @Post('redeem')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Redeem QZD for cash (bank/agent-only).' })
  async redeem(@Body() dto: RedeemRequest) {
    const payload = redeemSchema.parse(dto);
    return this.ledgerService.redeem(payload);
  }
}
