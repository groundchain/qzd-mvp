import { Body, Controller, Get, Post, Param, Query, Req } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { AccountsApi } from '../api/index.js';
import type { Account, Balance, CreateAccountRequest, ListAccountTransactions200Response,  } from '../models/index.js';

@Controller()
export class AccountsApiController {
  constructor(private readonly accountsApi: AccountsApi) {}

  @Post('/accounts')
  createAccount(@Body() createAccountRequest: CreateAccountRequest, @Req() request: Request): Account | Promise<Account> | Observable<Account> {
    return this.accountsApi.createAccount(createAccountRequest, request);
  }

  @Get('/accounts/:id/balance')
  getAccountBalance(@Param('id') id: string, @Req() request: Request): Balance | Promise<Balance> | Observable<Balance> {
    return this.accountsApi.getAccountBalance(id, request);
  }

  @Get('/accounts/:id/transactions')
  listAccountTransactions(@Param('id') id: string, @Query('limit') limit: number, @Query('cursor') cursor: string, @Req() request: Request): ListAccountTransactions200Response | Promise<ListAccountTransactions200Response> | Observable<ListAccountTransactions200Response> {
    return this.accountsApi.listAccountTransactions(id, limit, cursor, request);
  }

}
