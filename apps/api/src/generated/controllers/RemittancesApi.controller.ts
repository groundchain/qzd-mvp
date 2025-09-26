import { Body, Controller, Get, Post, Param, Query, Req } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { RemittancesApi } from '../api/index.js';
import type { AcquireQZDForUSRemittance202Response, QuoteResponse, USRemitAcquireQZDRequest,  } from '../models/index.js';

@Controller()
export class RemittancesApiController {
  constructor(private readonly remittancesApi: RemittancesApi) {}

  @Post('/remit/us/acquire-qzd')
  acquireQZDForUSRemittance(@Body() uSRemitAcquireQZDRequest: USRemitAcquireQZDRequest, @Req() request: Request): AcquireQZDForUSRemittance202Response | Promise<AcquireQZDForUSRemittance202Response> | Observable<AcquireQZDForUSRemittance202Response> {
    return this.remittancesApi.acquireQZDForUSRemittance(uSRemitAcquireQZDRequest, request);
  }

  @Get('/simulate/quote')
  simulateQuote(@Query('sellCurrency') sellCurrency: string, @Query('sellAmount') sellAmount: string, @Query('buyCurrency') buyCurrency: string, @Req() request: Request): QuoteResponse | Promise<QuoteResponse> | Observable<QuoteResponse> {
    return this.remittancesApi.simulateQuote(sellCurrency, sellAmount, buyCurrency, request);
  }

}
