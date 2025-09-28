/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Optional } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { AgentsApi } from '@qzd/sdk-api/server';
import type {
  AgentCashInRequest,
  AgentCashOutRequest,
  Transaction,
  Voucher,
} from '@qzd/sdk-api/server';
import { InMemoryBankService, getFallbackBankService } from '../in-memory-bank.service.js';

@Injectable()
export class AgentsApiImpl extends AgentsApi {
  private readonly bank: InMemoryBankService;

  constructor(@Optional() bank?: InMemoryBankService) {
    super();
    this.bank = bank ?? getFallbackBankService();
  }

  override agentCashIn(
    _idempotencyKey: string,
    agentCashInRequest: AgentCashInRequest,
    request: Request,
  ): Transaction | Promise<Transaction> | Observable<Transaction> {
    return this.bank.agentCashIn(agentCashInRequest, request);
  }

  override agentCashOut(
    _idempotencyKey: string,
    agentCashOutRequest: AgentCashOutRequest,
    request: Request,
  ): Voucher | Promise<Voucher> | Observable<Voucher> {
    return this.bank.agentCashOut(agentCashOutRequest, request);
  }

  override redeemVoucher(
    code: string,
    _idempotencyKey: string,
    request: Request,
  ): Voucher | Promise<Voucher> | Observable<Voucher> {
    return this.bank.redeemVoucher(code, request);
  }
}
