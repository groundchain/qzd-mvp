/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Optional } from '@nestjs/common';
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
import { InMemoryBankService, getFallbackBankService } from '../in-memory-bank.service.js';

@Injectable()
export class AccountsApiImpl extends AccountsApi {
  private readonly bank: InMemoryBankService;

  constructor(@Optional() bank?: InMemoryBankService) {
    super();
    this.bank = bank ?? getFallbackBankService();
  }

  override createAccount(
    createAccountRequest: CreateAccountRequest,
    request: Request,
  ): Account | Promise<Account> | Observable<Account> {
    return this.bank.createAccount(createAccountRequest, request);
  }

  override getAccountBalance(
    id: string,
    request: Request,
  ): Balance | Promise<Balance> | Observable<Balance> {
    return this.bank.getAccountBalance(id, request);
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
    const resolvedLimit = typeof limit === 'number' && Number.isFinite(limit) ? limit : undefined;
    return this.bank.listAccountTransactions(id, request, resolvedLimit, cursor);
  }

  override uploadAccountKyc(
    uploadAccountKycRequest: UploadAccountKycRequest,
    request: Request,
  ): Account | Promise<Account> | Observable<Account> {
    return this.bank.updateAccountKyc(uploadAccountKycRequest, request);
  }
}
