/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { HealthApi } from '@qzd/sdk-api/server';
import type {
  GetLiveness200Response,
  GetReadiness200Response,
} from '@qzd/sdk-api/server';
import { AppService } from '../app.service.js';

@Injectable()
export class HealthApiImpl extends HealthApi {
  constructor(private readonly appService: AppService) {
    super();
  }

  override getLiveness(
    _request: Request,
  ): GetLiveness200Response | Promise<GetLiveness200Response> | Observable<GetLiveness200Response> {
    return this.appService.getLiveness();
  }

  override getReadiness(
    _request: Request,
  ): GetReadiness200Response | Promise<GetReadiness200Response> | Observable<GetReadiness200Response> {
    return this.appService.getReadiness();
  }
}
