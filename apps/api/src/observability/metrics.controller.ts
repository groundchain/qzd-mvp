import { Controller, Get, Header } from '@nestjs/common';
import { getMetricsSnapshot, metricsContentType } from './metrics.js';

@Controller()
export class MetricsController {
  @Get('metrics')
  @Header('Content-Type', metricsContentType)
  @Header('Cache-Control', 'no-store')
  getMetrics(): Promise<string> {
    return getMetricsSnapshot();
  }
}
