/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Optional } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { AdminApi } from '@qzd/sdk-api/server';
import type {
  IssuanceRequest,
  IssueRequest,
  ListAdminAlerts200Response,
  ListIssuanceRequests200Response,
  SignIssuanceRequestRequest,
} from '@qzd/sdk-api/server';
import { InMemoryBankService, getFallbackBankService } from '../in-memory-bank.service.js';

@Injectable()
export class AdminApiImpl extends AdminApi {
  private readonly bank: InMemoryBankService;

  constructor(@Optional() bank?: InMemoryBankService) {
    super();
    this.bank = bank ?? getFallbackBankService();
  }

  override createIssuanceRequest(
    issueRequest: IssueRequest,
    request: Request,
  ): IssuanceRequest | Promise<IssuanceRequest> | Observable<IssuanceRequest> {
    return this.bank.createIssuanceRequest(issueRequest, request);
  }

  override listAdminAlerts(
    _request: Request,
  ): ListAdminAlerts200Response | Promise<ListAdminAlerts200Response> | Observable<ListAdminAlerts200Response> {
    return { alerts: [] } satisfies ListAdminAlerts200Response;
  }

  override listIssuanceRequests(
    request: Request,
  ):
    | ListIssuanceRequests200Response
    | Promise<ListIssuanceRequests200Response>
    | Observable<ListIssuanceRequests200Response> {
    const items = this.bank.listIssuanceRequests(request);
    return { items } satisfies ListIssuanceRequests200Response;
  }

  override signIssuanceRequest(
    id: string,
    signIssuanceRequestRequest: SignIssuanceRequestRequest,
    request: Request,
  ): IssuanceRequest | Promise<IssuanceRequest> | Observable<IssuanceRequest> {
    return this.bank.signIssuanceRequest(id, signIssuanceRequestRequest.validatorId, request);
  }
}
