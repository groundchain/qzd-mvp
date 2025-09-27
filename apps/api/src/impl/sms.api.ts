/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Optional } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { SmsApi } from '@qzd/sdk-api/server';
import type { SmsInboundRequest, SmsInboundResponse } from '@qzd/sdk-api/server';
import { InMemoryBankService, getFallbackBankService } from '../in-memory-bank.service.js';

@Injectable()
export class SmsApiImpl extends SmsApi {
  private readonly bank: InMemoryBankService;

  constructor(@Optional() bank?: InMemoryBankService) {
    super();
    this.bank = bank ?? getFallbackBankService();
  }

  override receiveSmsInbound(
    smsInboundRequest: SmsInboundRequest,
    request: Request,
  ): SmsInboundResponse | Promise<SmsInboundResponse> | Observable<SmsInboundResponse> {
    return this.bank.receiveSmsInbound(smsInboundRequest, request);
  }
}
