import { randomBytes, randomUUID } from 'node:crypto';
import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';

export interface CardKeyPair {
  id: string;
  privateKeyHex: string;
  publicKeyHex: string;
}

export interface OfflineVoucherAmount {
  currency: string;
  value: string;
}

export interface OfflineVoucherDraft {
  id: string;
  fromCardId: string;
  toAccountId: string;
  amount: OfflineVoucherAmount;
  nonce: string;
  expiresAt: string;
}

export type OfflineVoucherStatus = 'pending' | 'redeemed';

export interface OfflineVoucher extends OfflineVoucherDraft {
  signature: string;
  status: OfflineVoucherStatus;
}

export function createMockCardKeys(cardId?: string): CardKeyPair {
  const privateKey = randomBytes(32);
  const privateKeyHex = bytesToHex(privateKey);
  const publicKeyHex = bytesToHex(ed25519.getPublicKey(privateKey));
  const id = cardId ?? (typeof randomUUID === 'function' ? `card_${randomUUID()}` : `card_${bytesToHex(randomBytes(6))}`);
  return { id, privateKeyHex, publicKeyHex } satisfies CardKeyPair;
}

export function createOfflineVoucherPayload(draft: OfflineVoucherDraft): Uint8Array {
  const canonical = [
    draft.id,
    draft.fromCardId,
    draft.toAccountId,
    draft.amount?.currency ?? '',
    draft.amount?.value ?? '',
    draft.nonce,
    draft.expiresAt
  ].join('\n');
  return new TextEncoder().encode(canonical);
}

export function signOfflineVoucher(draft: OfflineVoucherDraft, privateKeyHex: string): string {
  const payload = createOfflineVoucherPayload(draft);
  const signature = ed25519.sign(payload, hexToBytes(privateKeyHex));
  return bytesToHex(signature);
}

export function verifyOfflineVoucherSignature(
  draft: OfflineVoucherDraft,
  signatureHex: string,
  publicKeyHex: string
): boolean {
  const payload = createOfflineVoucherPayload(draft);
  return ed25519.verify(hexToBytes(signatureHex), payload, hexToBytes(publicKeyHex));
}

export function createOfflineVoucher(
  draft: OfflineVoucherDraft,
  privateKeyHex: string
): OfflineVoucher {
  return { ...draft, signature: signOfflineVoucher(draft, privateKeyHex), status: 'pending' };
}
