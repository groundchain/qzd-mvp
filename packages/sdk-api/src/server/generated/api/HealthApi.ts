import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import type { GetLiveness200Response, GetReadiness200Response,  } from '../models/index.js';


@Injectable()
export abstract class HealthApi {

  abstract getLiveness( request: Request): GetLiveness200Response | Promise<GetLiveness200Response> | Observable<GetLiveness200Response>;


  abstract getReadiness( request: Request): GetReadiness200Response | Promise<GetReadiness200Response> | Observable<GetReadiness200Response>;

}
