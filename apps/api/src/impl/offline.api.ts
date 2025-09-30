/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Optional } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { OfflineApi } from '@qzd/sdk-api/server';
import type { OfflineVoucher } from '@qzd/sdk-api/server';
import { InMemoryBankService, getFallbackBankService } from '../in-memory-bank.service.js';

@Injectable()
export class OfflineApiImpl extends OfflineApi {
  private readonly bank: InMemoryBankService;

  constructor(@Optional() bank?: InMemoryBankService) {
    super();
    this.bank = bank ?? getFallbackBankService();
  }

  override createOfflineVoucher(
    _idempotencyKey: string,
    offlineVoucher: OfflineVoucher,
    request: Request,
  ): OfflineVoucher | Promise<OfflineVoucher> | Observable<OfflineVoucher> {
    return this.bank.createOfflineVoucher(offlineVoucher, request);
  }

  override redeemOfflineVoucher(
    _idempotencyKey: string,
    id: string,
    request: Request,
  ): OfflineVoucher | Promise<OfflineVoucher> | Observable<OfflineVoucher> {
    return this.bank.redeemOfflineVoucher(id, request);
  }
}
