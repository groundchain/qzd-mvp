import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import type { Balance, IssueEnvelope, IssueRequest, ListValidators200Response, RedeemRequest, Transaction,  } from '../models/index.js';


@Injectable()
export abstract class LedgerApi {

  abstract getAccountBalance(id: string,  request: Request): Balance | Promise<Balance> | Observable<Balance>;


  abstract issueTokens(issueRequest: IssueRequest,  request: Request): IssueEnvelope | Promise<IssueEnvelope> | Observable<IssueEnvelope>;


  abstract listValidators( request: Request): ListValidators200Response | Promise<ListValidators200Response> | Observable<ListValidators200Response>;


  abstract redeemTokens(redeemRequest: RedeemRequest,  request: Request): Transaction | Promise<Transaction> | Observable<Transaction>;

}
