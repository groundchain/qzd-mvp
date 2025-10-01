/* eslint-disable @typescript-eslint/no-unused-vars */
import { BadRequestException, Injectable, Optional } from '@nestjs/common';
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
  Validator,
} from '@qzd/sdk-api/server';
import { InMemoryBankService, getFallbackBankService } from '../in-memory-bank.service.js';

const KNOWN_VALIDATORS: Validator[] = [
  {
    id: 'validator-1',
    name: 'Nodo Norte QZD',
    status: 'active',
    endpoint: 'https://validator1.qzd.example.com',
  },
  {
    id: 'validator-2',
    name: 'Nodo Central QZD',
    status: 'active',
    endpoint: 'https://validator2.qzd.example.com',
  },
  {
    id: 'validator-3',
    name: 'Nodo Sur QZD',
    status: 'standby',
    endpoint: 'https://validator3.qzd.example.com',
  },
];

@Injectable()
export class LedgerApiImpl extends LedgerApi {
  private readonly bank: InMemoryBankService;

  constructor(@Optional() bank?: InMemoryBankService) {
    super();
    this.bank = bank ?? getFallbackBankService();
  }

  override createIssuanceRequest(
    idempotencyKey: string,
    issueRequest: IssueRequest,
    request: Request,
  ): IssuanceRequest | Promise<IssuanceRequest> | Observable<IssuanceRequest> {
    return this.bank.createIssuanceRequest(issueRequest, request);
  }

  override getAccountBalance(
    id: string,
    request: Request,
  ): Balance | Promise<Balance> | Observable<Balance> {
    return this.bank.getAccountBalance(id, request);
  }

  override issueTokens(
    idempotencyKey: string,
    issueTokensRequest: IssueTokensRequest,
    request: Request,
  ): Transaction | Promise<Transaction> | Observable<Transaction> {
    return this.bank.issueFromRequest(issueTokensRequest, request);
  }

  override listValidators(
    request: Request,
  ):
    | ListValidators200Response
    | Promise<ListValidators200Response>
    | Observable<ListValidators200Response> {
    return { validators: KNOWN_VALIDATORS } satisfies ListValidators200Response;
  }

  override redeemTokens(
    idempotencyKey: string,
    redeemRequest: RedeemRequest,
    request: Request,
  ): Transaction | Promise<Transaction> | Observable<Transaction> {
    throw new BadRequestException('Redemptions are not supported in the demo environment');
  }
}
