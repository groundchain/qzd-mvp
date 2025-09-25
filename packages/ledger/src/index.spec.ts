import { describe, expect, it } from 'vitest';
import { AppendOnlyLedger, createSigner } from './index.js';

describe('AppendOnlyLedger', () => {
  it('appends signed entries that verify with public key', () => {
    const ledger = new AppendOnlyLedger<{ amount: number }>();
    const signer = createSigner();

    const entry = ledger.append({ amount: 100 }, signer);

    expect(entry.index).toBe(0);
    expect(ledger.verify(entry, signer.publicKey)).toBe(true);
  });
});
