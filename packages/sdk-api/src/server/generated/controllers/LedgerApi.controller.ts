import { Body, Controller, Get, Post, Param, Query, Req } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { LedgerApi } from '../api/index.js';
import type { Balance, IssueEnvelope, IssueRequest, ListValidators200Response, RedeemRequest, Transaction,  } from '../models/index.js';

@Controller()
export class LedgerApiController {
  constructor(private readonly ledgerApi: LedgerApi) {}

  @Get('/accounts/:id/balance')
  getAccountBalance(@Param('id') id: string, @Req() request: Request): Balance | Promise<Balance> | Observable<Balance> {
    return this.ledgerApi.getAccountBalance(id, request);
  }

  @Post('/tx/issue')
  issueTokens(@Body() issueRequest: IssueRequest, @Req() request: Request): IssueEnvelope | Promise<IssueEnvelope> | Observable<IssueEnvelope> {
    return this.ledgerApi.issueTokens(issueRequest, request);
  }

  @Get('/validators')
  listValidators(@Req() request: Request): ListValidators200Response | Promise<ListValidators200Response> | Observable<ListValidators200Response> {
    return this.ledgerApi.listValidators(request);
  }

  @Post('/tx/redeem')
  redeemTokens(@Body() redeemRequest: RedeemRequest, @Req() request: Request): Transaction | Promise<Transaction> | Observable<Transaction> {
    return this.ledgerApi.redeemTokens(redeemRequest, request);
  }

}
