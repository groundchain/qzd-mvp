import { describe, expect, it } from 'vitest';
import { AppService } from './app.service.js';

describe('AppService', () => {
  it('returns a validated health payload', () => {
    const service = new AppService();
    const result = service.getHealth();

    expect(result.status).toBe('ok');
    expect(result.uptime).toBeTypeOf('number');
  });
});
