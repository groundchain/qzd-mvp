declare module '@noble/hashes/sha256' {
  export function sha256(message: Uint8Array | string): Uint8Array;
}

declare module '@noble/hashes/utils' {
  export function bytesToHex(bytes: Uint8Array): string;
  export function hexToBytes(hex: string): Uint8Array;
}

declare module '@noble/curves/secp256k1' {
  export interface Secp256k1Signature {
    toCompactRawBytes(): Uint8Array;
  }

  export const secp256k1: {
    getPublicKey(privateKey: Uint8Array | string, isCompressed?: boolean): Uint8Array;
    sign(hash: Uint8Array, privateKey: Uint8Array | string): Secp256k1Signature;
    verify(signature: Uint8Array | string, hash: Uint8Array, publicKey: Uint8Array | string): boolean;
  };
}
