/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { AdminApi } from '../generated/api/index.js';
import type { ListAdminAlerts200Response } from '../generated/models/index.js';

@Injectable()
export class AdminApiImpl extends AdminApi {
  override listAdminAlerts(
    request: Request,
  ): ListAdminAlerts200Response | Promise<ListAdminAlerts200Response> | Observable<ListAdminAlerts200Response> {
    throw new Error('Method not implemented.');
  }
}
