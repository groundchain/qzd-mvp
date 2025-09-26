import { Body, Controller, Get, Post, Param, Query, Req } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { RemittancesApi } from '../api/index.js';
import type { QuoteResponse, Transaction, USRemitAcquireQZDRequest,  } from '../models/index.js';

@Controller()
export class RemittancesApiController {
  constructor(private readonly remittancesApi: RemittancesApi) {}

  @Post('/remit/us/acquire-qzd')
  acquireQZDForUSRemittance(@Body() uSRemitAcquireQZDRequest: USRemitAcquireQZDRequest, @Req() request: Request): Transaction | Promise<Transaction> | Observable<Transaction> {
    return this.remittancesApi.acquireQZDForUSRemittance(uSRemitAcquireQZDRequest, request);
  }

  @Get('/simulate/quote')
  simulateQuote(@Query('usdAmount') usdAmount: string, @Query('scenario') scenario: string, @Req() request: Request): QuoteResponse | Promise<QuoteResponse> | Observable<QuoteResponse> {
    return this.remittancesApi.simulateQuote(usdAmount, scenario, request);
  }

}
