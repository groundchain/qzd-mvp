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
    _idempotencyKey: string,
    issueRequest: IssueRequest,
    request: Request,
  ): IssuanceRequest | Promise<IssuanceRequest> | Observable<IssuanceRequest> {
    return this.bank.createIssuanceRequest(issueRequest, request);
  }

  override listAdminAlerts(
    request: Request,
  ): ListAdminAlerts200Response | Promise<ListAdminAlerts200Response> | Observable<ListAdminAlerts200Response> {
    const alerts = this.bank.listAdminAlerts(request);
    return { alerts } satisfies ListAdminAlerts200Response;
  }

  override acknowledgeAdminAlert(
    id: string,
    request: Request,
  ): void | Promise<void> | Observable<void> {
    this.bank.acknowledgeAlert(id, request);
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
    _idempotencyKey: string,
    signIssuanceRequestRequest: SignIssuanceRequestRequest,
    request: Request,
  ): IssuanceRequest | Promise<IssuanceRequest> | Observable<IssuanceRequest> {
    return this.bank.signIssuanceRequest(id, signIssuanceRequestRequest, request);
  }
}
