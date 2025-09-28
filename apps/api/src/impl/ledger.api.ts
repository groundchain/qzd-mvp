/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { LedgerApi } from '@qzd/sdk-api/server';
import type {
  Balance,
  IssuanceRequest,
  IssueRequest,
  IssueTokensRequest,
  ListValidators200Response,
  RedeemRequest,
  Transaction,
} from '@qzd/sdk-api/server';

@Injectable()
export class LedgerApiImpl extends LedgerApi {
  override createIssuanceRequest(
    _idempotencyKey: string,
    _issueRequest: IssueRequest,
    _request: Request,
  ): IssuanceRequest | Promise<IssuanceRequest> | Observable<IssuanceRequest> {
    throw new Error('Method not implemented.');
  }

  override getAccountBalance(
    id: string,
    request: Request,
  ): Balance | Promise<Balance> | Observable<Balance> {
    throw new Error('Method not implemented.');
  }

  override issueTokens(
    _idempotencyKey: string,
    _issueTokensRequest: IssueTokensRequest,
    _request: Request,
  ): Transaction | Promise<Transaction> | Observable<Transaction> {
    throw new Error('Method not implemented.');
  }

  override listValidators(
    request: Request,
  ): ListValidators200Response | Promise<ListValidators200Response> | Observable<ListValidators200Response> {
    throw new Error('Method not implemented.');
  }

  override redeemTokens(
    _idempotencyKey: string,
    redeemRequest: RedeemRequest,
    request: Request,
  ): Transaction | Promise<Transaction> | Observable<Transaction> {
    throw new Error('Method not implemented.');
  }
}
