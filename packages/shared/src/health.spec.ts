import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('accepts valid payloads', () => {
    const parsed = healthResponseSchema.parse({ status: 'ok', uptime: 10 });
    expect(parsed.uptime).toBe(10);
  });

  it('rejects invalid payloads', () => {
    expect(() => healthResponseSchema.parse({ status: 'down', uptime: -1 })).toThrowError();
  });
});
