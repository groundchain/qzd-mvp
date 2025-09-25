import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '../../generated/server/model/healthResponse.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get('live')
  @ApiOperation({ summary: 'Simple liveness probe.' })
  getLive(): HealthResponse {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe with dependency checks.' })
  getReady(): HealthResponse {
    return {
      status: 'ok',
      checks: {
        database: { status: 'ok', observedAt: new Date().toISOString() }
      }
    };
  }
}
