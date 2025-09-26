import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import type { QuoteResponse, Transaction, USRemitAcquireQZDRequest,  } from '../models/index.js';


@Injectable()
export abstract class RemittancesApi {

  abstract acquireQZDForUSRemittance(uSRemitAcquireQZDRequest: USRemitAcquireQZDRequest,  request: Request): Transaction | Promise<Transaction> | Observable<Transaction>;


  abstract simulateQuote(usdAmount: string, scenario: string,  request: Request): QuoteResponse | Promise<QuoteResponse> | Observable<QuoteResponse>;

}
