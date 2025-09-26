/* eslint-disable @typescript-eslint/no-unused-vars */
import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { TransactionsApi } from '@qzd/sdk-api/server';
import type {
  IssueEnvelope,
  IssueRequest,
  ListAccountTransactions200Response,
  RedeemRequest,
  Transaction,
  TransferRequest,
} from '@qzd/sdk-api/server';
import { InMemoryBankService, getFallbackBankService } from '../in-memory-bank.service.js';

@Injectable()
export class TransactionsApiImpl extends TransactionsApi {
  private readonly bank: InMemoryBankService;

  constructor(@Optional() bank?: InMemoryBankService) {
    super();
    this.bank = bank ?? getFallbackBankService();
  }

  override initiateTransfer(
    transferRequest: TransferRequest,
    request: Request,
  ): Transaction | Promise<Transaction> | Observable<Transaction> {
    return this.bank.initiateTransfer(transferRequest, request);
  }

  override issueTokens(
    _issueRequest: IssueRequest,
    _request: Request,
  ): IssueEnvelope | Promise<IssueEnvelope> | Observable<IssueEnvelope> {
    throw new BadRequestException('Issuance is not supported in the demo environment');
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

  override redeemTokens(
    _redeemRequest: RedeemRequest,
    _request: Request,
  ): Transaction | Promise<Transaction> | Observable<Transaction> {
    throw new BadRequestException('Redemptions are not supported in the demo environment');
  }
}
