import { Body, Controller, Get, Param, Query, Req } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { AdminApi } from '../api/index.js';
import type { ListAdminAlerts200Response,  } from '../models/index.js';

@Controller()
export class AdminApiController {
  constructor(private readonly adminApi: AdminApi) {}

  @Get('/admin/alerts')
  listAdminAlerts(@Req() request: Request): ListAdminAlerts200Response | Promise<ListAdminAlerts200Response> | Observable<ListAdminAlerts200Response> {
    return this.adminApi.listAdminAlerts(request);
  }

}
