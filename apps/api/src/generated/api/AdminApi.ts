import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import type { ListAdminAlerts200Response,  } from '../models/index.js';


@Injectable()
export abstract class AdminApi {

  abstract listAdminAlerts( request: Request): ListAdminAlerts200Response | Promise<ListAdminAlerts200Response> | Observable<ListAdminAlerts200Response>;

}
