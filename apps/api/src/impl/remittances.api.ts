/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Optional } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { RemittancesApi } from '@qzd/sdk-api/server';
import type { QuoteResponse, Transaction, USRemitAcquireQZDRequest } from '@qzd/sdk-api/server';
import { RemittancesService } from '../remittances.service.js';

@Injectable()
export class RemittancesApiImpl extends RemittancesApi {
  private readonly service: RemittancesService;

  constructor(@Optional() service?: RemittancesService) {
    super();
    this.service = service ?? new RemittancesService();
  }

  override acquireQZDForUSRemittance(
    _idempotencyKey: string,
    uSRemitAcquireQZDRequest: USRemitAcquireQZDRequest,
    _request: Request,
  ): Transaction | Promise<Transaction> | Observable<Transaction> {
    return this.service.acquireQzd(uSRemitAcquireQZDRequest);
  }

  override simulateQuote(
    usdAmount: string,
    scenario: string = 'DEFAULT',
    _request: Request,
  ): QuoteResponse | Promise<QuoteResponse> | Observable<QuoteResponse> {
    return this.service.simulateQuote(usdAmount, scenario);
  }
}
