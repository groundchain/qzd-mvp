import { Injectable } from '@nestjs/common';
import { healthResponseSchema } from '@qzd/shared';
import type { GetLiveness200Response, GetReadiness200Response } from '@qzd/sdk-api/server';

const READINESS_DEPENDENCIES: GetReadiness200Response['dependencies'] = [
  { name: 'inMemoryBank', status: 'healthy' },
];

@Injectable()
export class AppService {
  getHealth() {
    return healthResponseSchema.parse({ status: 'ok', uptime: process.uptime() });
  }

  getLiveness(): GetLiveness200Response {
    return { status: 'live' } satisfies GetLiveness200Response;
  }

  getReadiness(): GetReadiness200Response {
    return {
      status: 'ready',
      dependencies: READINESS_DEPENDENCIES,
    } satisfies GetReadiness200Response;
  }
}
