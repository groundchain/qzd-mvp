import { Injectable } from '@nestjs/common';
import { healthResponseSchema } from '@qzd/shared';

@Injectable()
export class AppService {
  getHealth() {
    return healthResponseSchema.parse({ status: 'ok', uptime: process.uptime() });
  }
}
