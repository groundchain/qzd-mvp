import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { AcquireRemittanceInput } from './dto/acquire-remittance.dto.js';

@Injectable()
export class RemittanceService {
  async acquire(dto: AcquireRemittanceInput) {
    const exchangeRate = 1;
    return {
      remittanceId: crypto.randomUUID(),
      usdAmount: dto.amountUsd,
      qzdAmount: dto.amountUsd * exchangeRate,
      destinationAccountId: dto.destinationAccountId,
      status: 'settled'
    } as const;
  }
}
