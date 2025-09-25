import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import type { AcquireRemittanceRequest } from '../../generated/server/model/acquireRemittanceRequest.js';
import type { RemittanceAcceptedResponse } from '../../generated/server/model/remittanceAcceptedResponse.js';
import type { RemittanceQuote } from '../../generated/server/model/remittanceQuote.js';

@Injectable()
export class RemittanceService {
  async acquire(dto: AcquireRemittanceRequest): Promise<RemittanceAcceptedResponse> {
    const fxRate = dto.fxRate ?? '7.75';
    const quote: RemittanceQuote = {
      usdAmount: dto.usdAmount,
      qzdAmount: (Number(dto.usdAmount) * Number(fxRate)).toFixed(2),
      fxRate
    };

    return {
      remittanceId: crypto.randomUUID(),
      quote,
      status: 'pending_funding',
      estimatedSettlement: new Date(Date.now() + 2 * 60_000).toISOString()
    };
  }
}
