import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import type { Account, Balance, CreateAccountRequest, ListAccountTransactions200Response,  } from '../models/index.js';


@Injectable()
export abstract class AccountsApi {

  abstract createAccount(createAccountRequest: CreateAccountRequest,  request: Request): Account | Promise<Account> | Observable<Account>;


  abstract getAccountBalance(id: string,  request: Request): Balance | Promise<Balance> | Observable<Balance>;


  abstract listAccountTransactions(id: string, limit: number, cursor: string,  request: Request): ListAccountTransactions200Response | Promise<ListAccountTransactions200Response> | Observable<ListAccountTransactions200Response>;

}
