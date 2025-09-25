import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import type { HealthResponse } from '@qzd/shared';

export type LedgerEntry<T = unknown> = {
  index: number;
  payload: T;
  previousHash: string | null;
  hash: string;
  signature: string;
};

export interface LedgerSigner {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export class AppendOnlyLedger<T = unknown> {
  private readonly entries: LedgerEntry<T>[] = [];

  append(payload: T, signer: LedgerSigner): LedgerEntry<T> {
    const previousHash = this.entries.at(-1)?.hash ?? null;
    const index = this.entries.length;
    const message = this.encodeMessage(index, payload, previousHash);
    const digest = sha256(message);
    const signature = bytesToHex(secp256k1.sign(digest, signer.privateKey).toCompactRawBytes());
    const hash = bytesToHex(digest);

    const entry: LedgerEntry<T> = { index, payload, previousHash, hash, signature };
    this.entries.push(entry);
    return entry;
  }

  verify(entry: LedgerEntry<T>, publicKey: Uint8Array): boolean {
    const message = this.encodeMessage(entry.index, entry.payload, entry.previousHash);
    const digest = sha256(message);
    return secp256k1.verify(hexToBytes(entry.signature), digest, publicKey);
  }

  getAll() {
    return [...this.entries];
  }

  private encodeMessage(index: number, payload: T, previousHash: string | null) {
    const text = JSON.stringify({ index, payload, previousHash });
    return new TextEncoder().encode(text);
  }
}

export function createSigner(): LedgerSigner {
  const privateKey = secp256k1.utils.randomPrivateKey();
  const publicKey = secp256k1.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

export type { HealthResponse };
