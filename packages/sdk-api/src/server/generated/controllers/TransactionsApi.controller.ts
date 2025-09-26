import { Body, Controller, Get, Post, Param, Query, Req } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { TransactionsApi } from '../api/index.js';
import type { IssueEnvelope, IssueRequest, ListAccountTransactions200Response, RedeemRequest, Transaction, TransferRequest,  } from '../models/index.js';

@Controller()
export class TransactionsApiController {
  constructor(private readonly transactionsApi: TransactionsApi) {}

  @Post('/tx/transfer')
  initiateTransfer(@Body() transferRequest: TransferRequest, @Req() request: Request): Transaction | Promise<Transaction> | Observable<Transaction> {
    return this.transactionsApi.initiateTransfer(transferRequest, request);
  }

  @Post('/tx/issue')
  issueTokens(@Body() issueRequest: IssueRequest, @Req() request: Request): IssueEnvelope | Promise<IssueEnvelope> | Observable<IssueEnvelope> {
    return this.transactionsApi.issueTokens(issueRequest, request);
  }

  @Get('/accounts/:id/transactions')
  listAccountTransactions(@Param('id') id: string, @Query('limit') limit: number, @Query('cursor') cursor: string, @Req() request: Request): ListAccountTransactions200Response | Promise<ListAccountTransactions200Response> | Observable<ListAccountTransactions200Response> {
    return this.transactionsApi.listAccountTransactions(id, limit, cursor, request);
  }

  @Post('/tx/redeem')
  redeemTokens(@Body() redeemRequest: RedeemRequest, @Req() request: Request): Transaction | Promise<Transaction> | Observable<Transaction> {
    return this.transactionsApi.redeemTokens(redeemRequest, request);
  }

}
