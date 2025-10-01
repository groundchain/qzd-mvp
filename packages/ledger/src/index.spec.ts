import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';

import {
  AppendOnlyLedger,
  type LedgerSignature,
  type LedgerValidator,
  type PostEntryInput,
  validateMultisig,
} from './index.js';

const validatorPrivKeys = [
  '4b8c5bd2b1c78e51a384643b4c8973d5ac25e83e5a69e9e9240a0f3a3e981f01',
  '7f1ceab9da39979f68fb82ca5c22c02995ee50f74f072fe97c1a1c9bf9efcc02',
  '5a6f06ed4af3ad7f26d2a7f85407a820b2ce52402ac2c2a3841216295dac8603',
];

const validators: LedgerValidator[] = validatorPrivKeys.map((hex, index) => ({
  id: `validator-${index + 1}`,
  publicKey: bytesToHex(secp256k1.getPublicKey(hexToBytes(hex), true)),
}));

function signCanonical(canonical: string, privHex: string): string {
  const digest = sha256(new TextEncoder().encode(canonical));
  return bytesToHex(secp256k1.sign(digest, hexToBytes(privHex)).toCompactRawBytes());
}

function canonicalString(input: PostEntryInput): string {
  const payload = {
    type: input.type,
    amount: input.amount,
    asset: input.asset,
    from_account: input.from_account ?? null,
    to_account: input.to_account ?? null,
    memo: input.memo ?? null,
    meta: input.meta ?? {},
    ts: input.ts ? new Date(input.ts).toISOString() : undefined,
  };

  return JSON.stringify(canonicalize(payload));
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

function createLedger(threshold = 2) {
  return new AppendOnlyLedger({ issuanceValidators: validators, issuanceThreshold: threshold });
}

function signWithValidators(canonical: string, count: number) {
  return validatorPrivKeys.slice(0, count).map((privHex, index) => ({
    validatorId: validators[index].id,
    signature: signCanonical(canonical, privHex),
  }));
}

describe('AppendOnlyLedger', () => {
  it('issues funds with valid multisig and updates balance', () => {
    const ledger = createLedger();
    const recipient = ledger.openAccount({
      alias: 'alice',
      kyc_level: 'FULL',
      public_key: 'alice-key',
    });

    const entryInput: PostEntryInput = {
      type: 'ISSUE',
      amount: 1_000,
      asset: 'QZD',
      to_account: recipient.id,
      sigs: [],
    };

    const canonical = canonicalString(entryInput);
    entryInput.sigs = validatorPrivKeys.slice(0, 2).map((privHex, index) => ({
      validatorId: validators[index].id,
      signature: signCanonical(canonical, privHex),
    }));

    const entry = ledger.postEntry(entryInput);
    expect(entry.tx_hash).toMatch(/^[0-9a-f]+$/);
    expect(ledger.getAccountBalance(recipient.id, 'QZD')).toBe(1_000);
  });

  it('rejects issuance when signatures are invalid', () => {
    const ledger = createLedger();
    const recipient = ledger.openAccount({
      alias: 'bob',
      kyc_level: 'FULL',
      public_key: 'bob-key',
    });

    const entryInput: PostEntryInput = {
      type: 'ISSUE',
      amount: 500,
      asset: 'QZD',
      to_account: recipient.id,
      sigs: [
        {
          validatorId: validators[0].id,
          signature: '00'.repeat(64),
        },
      ],
    };

    expect(() => ledger.postEntry(entryInput)).toThrowError('Invalid issuance signatures');
  });

  it('transfers funds between accounts', () => {
    const ledger = createLedger();
    const alice = ledger.openAccount({ alias: 'alice', kyc_level: 'FULL', public_key: 'alice-key' });
    const bob = ledger.openAccount({ alias: 'bob', kyc_level: 'FULL', public_key: 'bob-key' });

    const issueInput: PostEntryInput = {
      type: 'ISSUE',
      amount: 1_500,
      asset: 'QZD',
      to_account: alice.id,
      sigs: [],
    };
    const issueCanonical = canonicalString(issueInput);
    issueInput.sigs = validatorPrivKeys.slice(0, 2).map((privHex, index) => ({
      validatorId: validators[index].id,
      signature: signCanonical(issueCanonical, privHex),
    }));
    ledger.postEntry(issueInput);

    ledger.postEntry({
      type: 'TRANSFER',
      amount: 700,
      asset: 'QZD',
      from_account: alice.id,
      to_account: bob.id,
    });

    expect(ledger.getAccountBalance(alice.id, 'QZD')).toBe(800);
    expect(ledger.getAccountBalance(bob.id, 'QZD')).toBe(700);
  });

  it('redeems funds and reduces balance', () => {
    const ledger = createLedger();
    const alice = ledger.openAccount({ alias: 'alice', kyc_level: 'FULL', public_key: 'alice-key' });

    const issueInput: PostEntryInput = {
      type: 'ISSUE',
      amount: 1_000,
      asset: 'QZD',
      to_account: alice.id,
      sigs: [],
    };
    const canonical = canonicalString(issueInput);
    issueInput.sigs = validatorPrivKeys.slice(0, 2).map((privHex, index) => ({
      validatorId: validators[index].id,
      signature: signCanonical(canonical, privHex),
    }));
    ledger.postEntry(issueInput);

    ledger.postEntry({
      type: 'REDEEM',
      amount: 400,
      asset: 'QZD',
      from_account: alice.id,
    });

    expect(ledger.getAccountBalance(alice.id, 'QZD')).toBe(600);
  });

  it('blocks transactions for frozen accounts', () => {
    const ledger = createLedger();
    const frozen = ledger.openAccount({
      alias: 'frozen',
      kyc_level: 'FULL',
      public_key: 'frozen-key',
      status: 'FROZEN',
    });

    const entryInput: PostEntryInput = {
      type: 'ISSUE',
      amount: 100,
      asset: 'QZD',
      to_account: frozen.id,
      sigs: [],
    };
    const canonical = canonicalString(entryInput);
    entryInput.sigs = validatorPrivKeys.slice(0, 2).map((privHex, index) => ({
      validatorId: validators[index].id,
      signature: signCanonical(canonical, privHex),
    }));

    expect(() => ledger.postEntry(entryInput)).toThrowError(/not active/);
  });

  it('maintains append-only history snapshots with sequential identifiers', () => {
    const ledger = createLedger();
    const treasury = ledger.openAccount({ alias: 'treasury', kyc_level: 'FULL', public_key: 'treasury' });
    const bob = ledger.openAccount({ alias: 'bob', kyc_level: 'FULL', public_key: 'bob-key' });

    const issueInput: PostEntryInput = {
      type: 'ISSUE',
      amount: 2_000,
      asset: 'QZD',
      to_account: treasury.id,
      sigs: [],
    };
    const canonical = canonicalString(issueInput);
    issueInput.sigs = signWithValidators(canonical, 2);
    const first = ledger.postEntry(issueInput);

    expect(first.id).toBe(1);

    ledger.postEntry({
      type: 'TRANSFER',
      amount: 750,
      asset: 'QZD',
      from_account: treasury.id,
      to_account: bob.id,
    });

    const snapshot = ledger.getHistory();
    expect(snapshot.map((entry) => entry.id)).toEqual([1, 2]);

    snapshot.push({
      id: 999,
      ts: new Date().toISOString(),
      type: 'ADJUST',
      amount: 1,
      asset: 'QZD',
      from_account: null,
      to_account: null,
      memo: null,
      tx_hash: 'ignored',
      sigs: [],
      meta: {},
    });
    snapshot[0] = { ...snapshot[0]!, id: 123, amount: 99 };

    const fresh = ledger.getHistory();
    expect(fresh).toHaveLength(2);
    expect(fresh[0]?.amount).toBe(2_000);
    expect(fresh[1]?.id).toBe(2);
  });

  it('validates multisig helper function', () => {
    const payload: PostEntryInput = {
      type: 'ISSUE',
      amount: 100,
      asset: 'QZD',
      to_account: '1',
    };
    const canonical = canonicalString(payload);
    const signatures: LedgerSignature[] = validatorPrivKeys.slice(0, 2).map((privHex, index) => ({
      validatorId: validators[index].id,
      signature: signCanonical(canonical, privHex),
    }));

    expect(
      validateMultisig({
        canonical,
        signatures,
        validators,
        threshold: 2,
      }),
    ).toBe(true);

    expect(
      validateMultisig({
        canonical,
        signatures,
        validators,
        threshold: 3,
      }),
    ).toBe(false);
  });

  it('preserves conservation of value for transfers', () => {
    const ledger = createLedger();
    const accounts = Array.from({ length: 3 }, (_, i) =>
      ledger.openAccount({ alias: `acct-${i}`, kyc_level: 'FULL', public_key: `key-${i}` }),
    );

    const issueInput: PostEntryInput = {
      type: 'ISSUE',
      amount: 3_000,
      asset: 'QZD',
      to_account: accounts[0].id,
      sigs: [],
    };
    const canonical = canonicalString(issueInput);
    issueInput.sigs = validatorPrivKeys.slice(0, 2).map((privHex, index) => ({
      validatorId: validators[index].id,
      signature: signCanonical(canonical, privHex),
    }));
    ledger.postEntry(issueInput);

    const transferArb = fc.record({
      from: fc.integer({ min: 0, max: accounts.length - 1 }),
      to: fc.integer({ min: 0, max: accounts.length - 1 }),
      amount: fc.integer({ min: 1, max: 500 }),
    });

    fc.assert(
      fc.property(transferArb, ({ from, to, amount }) => {
        fc.pre(from !== to);
        const fromAccount = accounts[from];
        const toAccount = accounts[to];
        const currentBalance = ledger.getAccountBalance(fromAccount.id, 'QZD');
        fc.pre(currentBalance >= amount);

        ledger.postEntry({
          type: 'TRANSFER',
          amount,
          asset: 'QZD',
          from_account: fromAccount.id,
          to_account: toAccount.id,
        });

        const entries = ledger.getHistory();
        const totalIssued = entries
          .filter((entry) => entry.type === 'ISSUE' && entry.asset === 'QZD')
          .reduce((sum, entry) => sum + entry.amount, 0);
        const totalRedeemed = entries
          .filter((entry) => entry.type === 'REDEEM' && entry.asset === 'QZD')
          .reduce((sum, entry) => sum + entry.amount, 0);
        const balances = accounts.map((acct) => ledger.getAccountBalance(acct.id, 'QZD'));
        const net = balances.reduce((sum, bal) => sum + bal, 0);

        expect(net).toBe(totalIssued - totalRedeemed);
      }),
      { numRuns: 25 },
    );
  });
});

describe('validateMultisig threshold behaviour', () => {
  it('enforces multisig thresholds using unique validator signatures', () => {
    const payload: PostEntryInput = {
      type: 'ISSUE',
      amount: 150,
      asset: 'QZD',
      to_account: '1',
    };
    const canonical = canonicalString(payload);
    const validSignatures = signWithValidators(canonical, 2);

    expect(
      validateMultisig({
        canonical,
        signatures: [validSignatures[0]!, validSignatures[0]!],
        validators,
        threshold: 2,
      }),
    ).toBe(false);

    expect(
      validateMultisig({
        canonical,
        signatures: [
          ...validSignatures,
          { validatorId: 'unknown', signature: validSignatures[0]!.signature },
        ],
        validators,
        threshold: 2,
      }),
    ).toBe(true);

    expect(
      validateMultisig({
        canonical,
        signatures: [
          ...validSignatures,
          { validatorId: validators[1]!.id, signature: validSignatures[1]!.signature },
        ],
        validators,
        threshold: 3,
      }),
    ).toBe(false);
  });
});
