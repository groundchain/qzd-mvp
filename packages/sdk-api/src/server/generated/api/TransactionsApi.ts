import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import type { IssueEnvelope, IssueRequest, ListAccountTransactions200Response, RedeemRequest, Transaction, TransferRequest,  } from '../models/index.js';


@Injectable()
export abstract class TransactionsApi {

  abstract initiateTransfer(transferRequest: TransferRequest,  request: Request): Transaction | Promise<Transaction> | Observable<Transaction>;


  abstract issueTokens(issueRequest: IssueRequest,  request: Request): IssueEnvelope | Promise<IssueEnvelope> | Observable<IssueEnvelope>;


  abstract listAccountTransactions(id: string, limit: number, cursor: string,  request: Request): ListAccountTransactions200Response | Promise<ListAccountTransactions200Response> | Observable<ListAccountTransactions200Response>;


  abstract redeemTokens(redeemRequest: RedeemRequest,  request: Request): Transaction | Promise<Transaction> | Observable<Transaction>;

}
