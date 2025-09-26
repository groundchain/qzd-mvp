/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { HealthApi } from '@qzd/sdk-api/server';
import type {
  GetLiveness200Response,
  GetReadiness200Response,
} from '@qzd/sdk-api/server';

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
