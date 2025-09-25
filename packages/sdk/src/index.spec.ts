import { describe, expect, it, vi } from 'vitest';
import { ApiClient, createLedger, createSigner } from './index.js';

describe('ApiClient', () => {
  it('parses health response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ status: 'ok', uptime: 1 })
    } as Response);

    const client = new ApiClient({ baseUrl: 'https://example.com' });
    const health = await client.getHealth();

    expect(health.status).toBe('ok');
    expect(health.uptime).toBe(1);
    fetchMock.mockRestore();
  });
});

describe('createLedger', () => {
  it('creates a ledger capable of signing entries', () => {
    const ledger = createLedger<{ memo: string }>();
    const signer = createSigner();
    const entry = ledger.append({ memo: 'hello' }, signer);

    expect(entry.index).toBe(0);
    expect(ledger.verify(entry, signer.publicKey)).toBe(true);
  });
});
