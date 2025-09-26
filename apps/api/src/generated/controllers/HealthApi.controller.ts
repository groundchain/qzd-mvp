import { Body, Controller, Get, Param, Query, Req } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { HealthApi } from '../api/index.js';
import type { GetLiveness200Response, GetReadiness200Response,  } from '../models/index.js';

@Controller()
export class HealthApiController {
  constructor(private readonly healthApi: HealthApi) {}

  @Get('/health/live')
  getLiveness(@Req() request: Request): GetLiveness200Response | Promise<GetLiveness200Response> | Observable<GetLiveness200Response> {
    return this.healthApi.getLiveness(request);
  }

  @Get('/health/ready')
  getReadiness(@Req() request: Request): GetReadiness200Response | Promise<GetReadiness200Response> | Observable<GetReadiness200Response> {
    return this.healthApi.getReadiness(request);
  }

}
