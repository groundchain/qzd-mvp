/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { AccountsApi } from '@qzd/sdk-api/server';
import type {
  Account,
  Balance,
  CreateAccountRequest,
  ListAccountTransactions200Response,
  UploadAccountKycRequest,
} from '@qzd/sdk-api/server';

@Injectable()
export class AccountsApiImpl extends AccountsApi {
  override createAccount(
    createAccountRequest: CreateAccountRequest,
    request: Request,
  ): Account | Promise<Account> | Observable<Account> {
    throw new Error('Method not implemented.');
  }

  override getAccountBalance(
    id: string,
    request: Request,
  ): Balance | Promise<Balance> | Observable<Balance> {
    throw new Error('Method not implemented.');
  }

  override listAccountTransactions(
    id: string,
    limit: number,
    cursor: string,
    request: Request,
  ):
    | ListAccountTransactions200Response
    | Promise<ListAccountTransactions200Response>
    | Observable<ListAccountTransactions200Response> {
    throw new Error('Method not implemented.');
  }

  override uploadAccountKyc(
    uploadAccountKycRequest: UploadAccountKycRequest,
    request: Request,
  ): Account | Promise<Account> | Observable<Account> {
    throw new Error('Method not implemented.');
  }
}
