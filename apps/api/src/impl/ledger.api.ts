/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { LedgerApi } from '../generated/api/index.js';
import type {
  Balance,
  IssueEnvelope,
  IssueRequest,
  ListValidators200Response,
  RedeemRequest,
  Transaction,
} from '../generated/models/index.js';

@Injectable()
export class LedgerApiImpl extends LedgerApi {
  override getAccountBalance(
    id: string,
    request: Request,
  ): Balance | Promise<Balance> | Observable<Balance> {
    throw new Error('Method not implemented.');
  }

  override issueTokens(
    issueRequest: IssueRequest,
    request: Request,
  ): IssueEnvelope | Promise<IssueEnvelope> | Observable<IssueEnvelope> {
    throw new Error('Method not implemented.');
  }

  override listValidators(
    request: Request,
  ): ListValidators200Response | Promise<ListValidators200Response> | Observable<ListValidators200Response> {
    throw new Error('Method not implemented.');
  }

  override redeemTokens(
    redeemRequest: RedeemRequest,
    request: Request,
  ): Transaction | Promise<Transaction> | Observable<Transaction> {
    throw new Error('Method not implemented.');
  }
}
