import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import type { AcquireQZDForUSRemittance202Response, QuoteResponse, USRemitAcquireQZDRequest,  } from '../models/index.js';


@Injectable()
export abstract class RemittancesApi {

  abstract acquireQZDForUSRemittance(uSRemitAcquireQZDRequest: USRemitAcquireQZDRequest,  request: Request): AcquireQZDForUSRemittance202Response | Promise<AcquireQZDForUSRemittance202Response> | Observable<AcquireQZDForUSRemittance202Response>;


  abstract simulateQuote(sellCurrency: string, sellAmount: string, buyCurrency: string,  request: Request): QuoteResponse | Promise<QuoteResponse> | Observable<QuoteResponse>;

}
