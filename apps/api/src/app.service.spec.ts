import { describe, expect, it } from 'vitest';
import { AppService } from './app.service.js';

describe('AppService', () => {
  it('returns a validated health payload', () => {
    const service = new AppService();
    const result = service.getHealth();

    expect(result.status).toBe('ok');
    expect(result.uptime).toBeTypeOf('number');
  });

  it('reports a live status for liveness checks', () => {
    const service = new AppService();
    const result = service.getLiveness();

    expect(result).toEqual({ status: 'live' });
  });

  it('reports readiness with dependency health', () => {
    const service = new AppService();
    const result = service.getReadiness();

    expect(result.status).toBe('ready');
    expect(result.dependencies?.length).toBeGreaterThan(0);
    expect(result.dependencies?.[0]).toEqual({ name: 'inMemoryBank', status: 'healthy' });
  });
});
