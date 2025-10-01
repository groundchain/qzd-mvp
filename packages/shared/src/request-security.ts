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

const IDEMPOTENCY_HEADER = 'idempotency-key';
const NONCE_HEADER = 'x-qzd-nonce';
const SIGNATURE_HEADER = 'x-qzd-signature';

export const DEFAULT_REQUEST_SIGNING_PUBLIC_KEY_HEX =
  '855ccfa13e665195273601418ba69eae333ff5ef6a7123738247871e5d4732a8';

export const DEFAULT_RATE_LIMIT_MAX = 120;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

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

function serializeBodyText(bodyText: string | null): string {
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
  return serializeBodyText(text);
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

export function serializeBody(body: unknown): string {
  if (body === undefined) {
    return 'null';
  }

  return JSON.stringify(body ?? null);
}

export interface SignatureComponents {
  method: string;
  path: string;
  idempotencyKey: string;
  nonce: string;
  serializedBody: string;
}

export function createSignaturePayloadFromComponents(components: SignatureComponents): Uint8Array {
  return createSignaturePayload(
    components.method,
    components.path,
    components.idempotencyKey,
    components.nonce,
    components.serializedBody,
  );
}

export interface HeaderWritableResponse {
  set(field: string, value: string): unknown;
}

export interface RequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
  headers?: Record<string, unknown>;
  res?: unknown;
  ip?: string;
  ips?: string[];
}

export interface RateLimitOptions<TRequest extends RequestLike> {
  limit: number;
  windowMs: number;
  keyGenerator?: (request: TRequest) => string | undefined;
}

interface NormalizedRateLimitOptions<TRequest extends RequestLike>
  extends RateLimitOptions<TRequest> {
  limit: number;
  windowMs: number;
}

export interface RateLimitState {
  limit: number;
  remaining: number;
  resetAt: number;
  limited: boolean;
  retryAfterSeconds?: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RequestSecurityOptions<TRequest extends RequestLike> {
  publicKeyHex?: string;
  rateLimit?: RateLimitOptions<TRequest>;
}

export interface ValidatedMutationContext {
  scope: string;
  bodyHash: string;
}

export interface ValidatedMutationResult {
  context: ValidatedMutationContext;
  rateLimitState?: RateLimitState;
}

type RequestHeaders = Record<string, unknown>;

export class RequestSecurityError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly rateLimitState?: RateLimitState,
  ) {
    super(message);
    this.name = 'RequestSecurityError';
  }
}

export class RequestSecurityManager<TRequest extends RequestLike = RequestLike> {
  private readonly usedNonces = new Set<string>();
  private readonly idempotencyRecords = new Map<string, { bodyHash: string; response: unknown }>();
  private readonly publicKeyBytes: Uint8Array;
  private readonly rateLimiter?: RequestRateLimiter<TRequest>;

  constructor(options: RequestSecurityOptions<TRequest> = {}) {
    const publicKeyHex = options.publicKeyHex ?? DEFAULT_REQUEST_SIGNING_PUBLIC_KEY_HEX;
    this.publicKeyBytes = this.decodeHex(publicKeyHex, () =>
      new Error(
        'QZD_REQUEST_SIGNING_PUBLIC_KEY must be a hex-encoded string representing an Ed25519 public key.',
      ),
    );

    const rateLimit = this.normalizeRateLimitOptions(options.rateLimit);
    if (rateLimit) {
      this.rateLimiter = new RequestRateLimiter(rateLimit);
    }
  }

  validateMutation(request: TRequest, body: unknown): ValidatedMutationResult {
    const method = this.normalizeMethod(request);
    const path = this.normalizePath(request);
    const idempotencyKey = this.requireHeader(
      request,
      IDEMPOTENCY_HEADER,
      'Idempotency-Key header is required',
    );
    const nonce = this.requireHeader(request, NONCE_HEADER, 'X-QZD-Nonce header is required');
    const signatureHex = this.requireHeader(
      request,
      SIGNATURE_HEADER,
      'X-QZD-Signature header is required',
    );

    const signatureBytes = this.decodeHex(signatureHex, () =>
      new RequestSecurityError(400, 'INVALID_SIGNATURE', 'X-QZD-Signature header must be a hex-encoded string'),
    );
    const serializedBody = serializeBody(body);
    const payload = createSignaturePayloadFromComponents({
      method,
      path,
      idempotencyKey,
      nonce,
      serializedBody,
    });

    const isValid = ed25519.verify(signatureBytes, payload, this.publicKeyBytes);
    if (!isValid) {
      throw new RequestSecurityError(401, 'INVALID_SIGNATURE', 'Request signature is invalid.');
    }

    const rateLimitState = this.rateLimiter?.consume(request);
    if (rateLimitState?.limited) {
      throw new RequestSecurityError(429, 'TOO_MANY_REQUESTS', 'Rate limit exceeded.', rateLimitState);
    }

    if (this.usedNonces.has(nonce)) {
      throw new RequestSecurityError(409, 'REPLAY_DETECTED', 'Nonce has already been used.');
    }

    this.usedNonces.add(nonce);

    const scope = `${method}:${path}:${idempotencyKey}`;
    const bodyHash = serializedBody;

    return {
      context: { scope, bodyHash },
      rateLimitState,
    } satisfies ValidatedMutationResult;
  }

  applyIdempotency<T>(context: ValidatedMutationContext, factory: () => T): T {
    const existing = this.idempotencyRecords.get(context.scope);
    if (existing) {
      if (existing.bodyHash !== context.bodyHash) {
        throw new RequestSecurityError(
          409,
          'CONFLICT',
          'Idempotency key has already been used with a different payload.',
        );
      }
      return this.clone(existing.response) as T;
    }

    const result = factory();
    this.idempotencyRecords.set(context.scope, {
      bodyHash: context.bodyHash,
      response: this.clone(result),
    });

    return result;
  }

  reset(): void {
    this.usedNonces.clear();
    this.idempotencyRecords.clear();
    this.rateLimiter?.reset();
  }

  private normalizeMethod(request: TRequest): string {
    const candidate = (request as Partial<TRequest> & { method?: string }).method;
    return typeof candidate === 'string' && candidate ? candidate.toUpperCase() : 'POST';
  }

  private normalizePath(request: TRequest): string {
    const requestLike = request as Partial<TRequest> & { originalUrl?: string; url?: string };
    const original = typeof requestLike.originalUrl === 'string' ? requestLike.originalUrl : requestLike.url ?? '';
    const [path] = original.split('?');
    return path || '/';
  }

  private requireHeader(request: TRequest, name: string, message: string): string {
    const headers = this.getHeaders(request);
    const candidate = headers[name] ?? headers[name.toLowerCase()];
    const value = Array.isArray(candidate) ? candidate[0] : candidate;
    if (typeof value !== 'string' || !value.trim()) {
      throw new RequestSecurityError(400, 'INVALID_HEADER', message);
    }
    return value.trim();
  }

  private getHeaders(request: TRequest): RequestHeaders {
    const requestLike = request as Partial<TRequest> & { headers?: unknown };
    const candidate = requestLike.headers;
    if (candidate && typeof candidate === 'object') {
      return candidate as RequestHeaders;
    }
    return {};
  }

  private decodeHex(value: string, errorFactory: () => Error): Uint8Array {
    if (!HEX_PATTERN.test(value)) {
      throw errorFactory();
    }
    return hexToBytes(value);
  }

  private clone<T>(value: T): T {
    if (typeof globalThis.structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private normalizeRateLimitOptions(
    options?: RateLimitOptions<TRequest>,
  ): NormalizedRateLimitOptions<TRequest> | undefined {
    if (!options) {
      return undefined;
    }

    const limit = Number.isFinite(options.limit) ? Math.floor(options.limit) : Number.NaN;
    const windowMs = Number.isFinite(options.windowMs) ? Math.floor(options.windowMs) : Number.NaN;
    if (!Number.isFinite(limit) || !Number.isFinite(windowMs) || limit <= 0 || windowMs <= 0) {
      return undefined;
    }

    return {
      limit,
      windowMs,
      keyGenerator: options.keyGenerator,
    } satisfies NormalizedRateLimitOptions<TRequest>;
  }
}

class RequestRateLimiter<TRequest extends RequestLike> {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(private readonly options: NormalizedRateLimitOptions<TRequest>) {}

  consume(request: TRequest): RateLimitState {
    const key = this.options.keyGenerator?.(request) ?? this.extractKey(request);
    const now = Date.now();
    const limit = this.options.limit;
    const windowMs = this.options.windowMs;

    if (!key) {
      return {
        limit,
        remaining: limit,
        resetAt: now + windowMs,
        limited: false,
      } satisfies RateLimitState;
    }

    const existing = this.buckets.get(key);
    const bucket: RateLimitBucket = existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + windowMs };

    if (bucket.count >= limit) {
      const retryAfterMs = bucket.resetAt - now;
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      this.buckets.set(key, bucket);
      return {
        limit,
        remaining: 0,
        resetAt: bucket.resetAt,
        limited: true,
        retryAfterSeconds,
      } satisfies RateLimitState;
    }

    bucket.count += 1;
    this.buckets.set(key, bucket);
    const remaining = Math.max(0, limit - bucket.count);

    return {
      limit,
      remaining,
      resetAt: bucket.resetAt,
      limited: false,
    } satisfies RateLimitState;
  }

  reset(): void {
    this.buckets.clear();
  }

  private extractKey(request: TRequest): string | undefined {
    const requestLike = request as Partial<TRequest> & {
      ip?: string;
      ips?: string[];
    };

    if (Array.isArray(requestLike.ips) && requestLike.ips.length > 0) {
      return requestLike.ips[0] ?? undefined;
    }

    if (typeof requestLike.ip === 'string' && requestLike.ip) {
      return requestLike.ip;
    }

    const headers = this.getHeaders(request);
    const forwarded = headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0]?.trim() || undefined;
    }

    return 'global';
  }

  private getHeaders(request: TRequest): RequestHeaders {
    const requestLike = request as Partial<TRequest> & { headers?: unknown };
    const candidate = requestLike.headers;
    if (candidate && typeof candidate === 'object') {
      return candidate as RequestHeaders;
    }
    return {};
  }
}
