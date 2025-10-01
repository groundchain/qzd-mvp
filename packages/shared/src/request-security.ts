import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';

export const DEFAULT_DEV_SIGNING_PRIVATE_KEY_HEX =
  '0a3c8c97f7925ea37e46f69af43e219b1d09de89ec1a76cf2ce9a9289a392d5a';

type FetchImplementation = typeof fetch;

type RequestInfoInput = RequestInfo | URL;

type MutableRequestInit = RequestInit & { headers?: HeadersInit };

const HEX_PATTERN = /^([0-9a-fA-F]{2})+$/;
const SIGNED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const textEncoder = new TextEncoder();

function ensureSigningKeyHex(candidate: string | undefined): string {
  const normalized = candidate?.trim();
  if (!normalized) {
    throw new Error(
      'A signing private key is required to issue authenticated mutations. Provide a hex-encoded Ed25519 private key via configuration.',
    );
  }
  if (!HEX_PATTERN.test(normalized)) {
    throw new Error('Signing private key must be a hex-encoded string.');
  }
  return normalized;
}

function ensureSigningKeyBytes(candidate: string | undefined): Uint8Array {
  const signingKeyHex = ensureSigningKeyHex(candidate);
  const bytes = hexToBytes(signingKeyHex);
  if (bytes.byteLength !== 32 && bytes.byteLength !== 64) {
    throw new Error('Signing private key must represent a 32-byte or 64-byte Ed25519 key.');
  }
  return bytes;
}

function createNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buffer = new Uint8Array(16);
    crypto.getRandomValues(buffer);
    return bytesToHex(buffer);
  }
  const randomSuffix = Math.random().toString(16).slice(2);
  return `nonce-${Date.now()}-${randomSuffix}`;
}

function serializeBody(bodyText: string | null): string {
  if (!bodyText) {
    return 'null';
  }
  try {
    const parsed = JSON.parse(bodyText);
    return JSON.stringify(parsed ?? null);
  } catch (error) {
    console.warn('Failed to parse request body while preparing signature. Falling back to raw payload.', error);
    return bodyText;
  }
}

export function createSignaturePayload(
  method: string,
  pathWithQuery: string,
  idempotencyKey: string,
  nonce: string,
  serializedBody: string,
): Uint8Array {
  const canonical = `${method}\n${pathWithQuery}\n${idempotencyKey}\n${nonce}\n${serializedBody}`;
  return textEncoder.encode(canonical);
}

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `idem-${crypto.randomUUID()}`;
  }
  const randomSuffix = Math.random().toString(16).slice(2);
  return `idem-${Date.now()}-${randomSuffix}`;
}

function shouldSign(method: string): boolean {
  return SIGNED_METHODS.has(method);
}

async function readSerializedBody(request: Request): Promise<string> {
  const clone = request.clone();
  const text = await clone.text();
  return serializeBody(text);
}

function normalizeMethod(method: string | undefined): string {
  return typeof method === 'string' && method ? method.toUpperCase() : 'GET';
}

function normalizePath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}` || '/';
  } catch (error) {
    console.warn('Failed to parse request URL for signing. Falling back to raw input.', error);
    return url;
  }
}

export function createSignedFetch(
  signingKeyHex?: string,
  baseFetch: FetchImplementation = fetch,
): FetchImplementation {
  const fetchImpl = baseFetch;

  if (!signingKeyHex?.trim()) {
    return async (input: RequestInfoInput, init?: MutableRequestInit) => {
      const request = new Request(input as RequestInfo, init);
      const method = normalizeMethod(request.method);

      if (shouldSign(method)) {
        throw new Error(
          'A signing private key is required to issue authenticated mutations. Provide a hex-encoded Ed25519 private key via configuration.',
        );
      }

      return fetchImpl(request);
    };
  }

  const signingKeyBytes = ensureSigningKeyBytes(signingKeyHex);

  return async (input: RequestInfoInput, init?: MutableRequestInit) => {
    const request = new Request(input as RequestInfo, init);
    const method = normalizeMethod(request.method);

    if (!shouldSign(method)) {
      return fetchImpl(request);
    }

    const headers = new Headers(request.headers);
    const idempotencyKey = headers.get('Idempotency-Key') ?? createIdempotencyKey();
    const nonce = headers.get('X-QZD-Nonce') ?? createNonce();
    const pathWithQuery = normalizePath(request.url);
    const serializedBody = await readSerializedBody(request);
    const payload = createSignaturePayload(method, pathWithQuery, idempotencyKey, nonce, serializedBody);
    const signature = bytesToHex(ed25519.sign(payload, signingKeyBytes));

    headers.set('Idempotency-Key', idempotencyKey);
    headers.set('X-QZD-Nonce', nonce);
    headers.set('X-QZD-Signature', signature);

    const signedRequest = new Request(request, { headers });
    return fetchImpl(signedRequest);
  };
}
