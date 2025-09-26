/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { RemittancesApi } from '../generated/api/index.js';
import type {
  AcquireQZDForUSRemittance202Response,
  QuoteResponse,
  USRemitAcquireQZDRequest,
} from '../generated/models/index.js';

@Injectable()
export class RemittancesApiImpl extends RemittancesApi {
  override acquireQZDForUSRemittance(
    uSRemitAcquireQZDRequest: USRemitAcquireQZDRequest,
    request: Request,
  ):
    | AcquireQZDForUSRemittance202Response
    | Promise<AcquireQZDForUSRemittance202Response>
    | Observable<AcquireQZDForUSRemittance202Response> {
    throw new Error('Method not implemented.');
  }

  override simulateQuote(
    sellCurrency: string,
    sellAmount: string,
    buyCurrency: string,
    request: Request,
  ): QuoteResponse | Promise<QuoteResponse> | Observable<QuoteResponse> {
    throw new Error('Method not implemented.');
  }
}
