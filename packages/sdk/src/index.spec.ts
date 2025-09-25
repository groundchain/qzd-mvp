import { describe, expect, it, vi } from 'vitest';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';

import { ApiClient, createLedger } from './index.js';
import type { LedgerConfig, LedgerSignature } from '@qzd/ledger';

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
  it('creates a ledger with configurable validators', () => {
    const validatorPrivKeys = [
      '4b8c5bd2b1c78e51a384643b4c8973d5ac25e83e5a69e9e9240a0f3a3e981f01',
      '7f1ceab9da39979f68fb82ca5c22c02995ee50f74f072fe97c1a1c9bf9efcc02',
      '5a6f06ed4af3ad7f26d2a7f85407a820b2ce52402ac2c2a3841216295dac8603',
    ];

    const config: LedgerConfig = {
      issuanceThreshold: 2,
      issuanceValidators: validatorPrivKeys.map((privHex, idx) => ({
        id: `validator-${idx + 1}`,
        publicKey: bytesToHex(secp256k1.getPublicKey(hexToBytes(privHex), true)),
      })),
    };

    const ledger = createLedger(config);
    const account = ledger.openAccount({ alias: 'alice', kyc_level: 'FULL', public_key: 'alice-key' });

    const payload = {
      type: 'ISSUE' as const,
      amount: 100,
      asset: 'QZD',
      to_account: account.id,
      sigs: [] as LedgerSignature[],
    };

    const canonical = canonicalString(payload);
    payload.sigs = validatorPrivKeys.slice(0, 2).map((privHex, index) => ({
      validatorId: config.issuanceValidators[index].id,
      signature: signCanonical(canonical, privHex),
    }));

    const entry = ledger.postEntry(payload);
    expect(entry.type).toBe('ISSUE');
    expect(ledger.getAccountBalance(account.id, 'QZD')).toBe(100);
  });
});

function signCanonical(canonical: string, privHex: string): string {
  const digest = sha256(new TextEncoder().encode(canonical));
  return bytesToHex(secp256k1.sign(digest, hexToBytes(privHex)).toCompactRawBytes());
}

function canonicalString(input: { [key: string]: unknown }): string {
  return JSON.stringify(canonicalize(input));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const result: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      result[key] = canonicalize(val);
    }
    return result;
  }
  return value;
}
