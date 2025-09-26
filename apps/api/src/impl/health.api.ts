/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { HealthApi } from '../generated/api/index.js';
import type {
  GetLiveness200Response,
  GetReadiness200Response,
} from '../generated/models/index.js';

@Injectable()
export class HealthApiImpl extends HealthApi {
  override getLiveness(
    request: Request,
  ): GetLiveness200Response | Promise<GetLiveness200Response> | Observable<GetLiveness200Response> {
    throw new Error('Method not implemented.');
  }

  override getReadiness(
    request: Request,
  ): GetReadiness200Response | Promise<GetReadiness200Response> | Observable<GetReadiness200Response> {
    throw new Error('Method not implemented.');
  }
}
