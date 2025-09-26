/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { TransactionsApi } from '../generated/api/index.js';
import type {
  IssueEnvelope,
  IssueRequest,
  ListAccountTransactions200Response,
  RedeemRequest,
  Transaction,
  TransferRequest,
} from '../generated/models/index.js';

@Injectable()
export class TransactionsApiImpl extends TransactionsApi {
  override initiateTransfer(
    transferRequest: TransferRequest,
    request: Request,
  ): Transaction | Promise<Transaction> | Observable<Transaction> {
    throw new Error('Method not implemented.');
  }

  override issueTokens(
    issueRequest: IssueRequest,
    request: Request,
  ): IssueEnvelope | Promise<IssueEnvelope> | Observable<IssueEnvelope> {
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

  override redeemTokens(
    redeemRequest: RedeemRequest,
    request: Request,
  ): Transaction | Promise<Transaction> | Observable<Transaction> {
    throw new Error('Method not implemented.');
  }
}
