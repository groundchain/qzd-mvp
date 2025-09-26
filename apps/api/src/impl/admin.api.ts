/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { AdminApi } from '@qzd/sdk-api/server';
import type { ListAdminAlerts200Response } from '@qzd/sdk-api/server';

@Injectable()
export class AdminApiImpl extends AdminApi {
  override listAdminAlerts(
    request: Request,
  ): ListAdminAlerts200Response | Promise<ListAdminAlerts200Response> | Observable<ListAdminAlerts200Response> {
    throw new Error('Method not implemented.');
  }
}
