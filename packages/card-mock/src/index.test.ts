import { describe, expect, it } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';
import {
  createMockCardKeys,
  createOfflineVoucher,
  createOfflineVoucherPayload,
  verifyOfflineVoucherSignature,
  type OfflineVoucherDraft
} from './index.js';

const deterministicDraft: OfflineVoucherDraft = {
  id: 'voucher_123',
  fromCardId: 'card_alpha',
  toAccountId: 'acct_beta',
  amount: { currency: 'USD', value: '12.34' },
  nonce: 'nonce_456',
  expiresAt: '2030-01-01T00:00:00.000Z'
};

const deterministicPrivateKeyHex = Array.from({ length: 32 }, (_, index) =>
  index.toString(16).padStart(2, '0')
).join('');

const deterministicPublicKeyHex = bytesToHex(
  ed25519.getPublicKey(hexToBytes(deterministicPrivateKeyHex))
);

describe('createOfflineVoucherPayload', () => {
  it('serializes drafts into canonical newline separated values', () => {
    const payload = createOfflineVoucherPayload(deterministicDraft);
    const canonical = [
      deterministicDraft.id,
      deterministicDraft.fromCardId,
      deterministicDraft.toAccountId,
      deterministicDraft.amount.currency,
      deterministicDraft.amount.value,
      deterministicDraft.nonce,
      deterministicDraft.expiresAt
    ].join('\n');

    expect(new TextDecoder().decode(payload)).toEqual(canonical);
  });
});

describe('offline voucher signatures', () => {
  it('creates verifiable signatures for drafts', () => {
    const voucher = createOfflineVoucher(deterministicDraft, deterministicPrivateKeyHex);

    expect(voucher.status).toBe('pending');
    expect(verifyOfflineVoucherSignature(voucher, voucher.signature, deterministicPublicKeyHex)).toBe(true);
  });

  it('detects payload tampering', () => {
    const voucher = createOfflineVoucher(deterministicDraft, deterministicPrivateKeyHex);
    const tamperedDraft = { ...voucher, amount: { ...voucher.amount, value: '99.99' } };

    expect(verifyOfflineVoucherSignature(tamperedDraft, voucher.signature, deterministicPublicKeyHex)).toBe(false);
  });
});

describe('createMockCardKeys', () => {
  it('derives the expected public key for the generated private key', () => {
    const pair = createMockCardKeys('card_test');

    expect(pair.id).toBe('card_test');
    expect(pair.privateKeyHex).toHaveLength(64);
    expect(pair.publicKeyHex).toEqual(bytesToHex(ed25519.getPublicKey(hexToBytes(pair.privateKeyHex))));
  });
});
