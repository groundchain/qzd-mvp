import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { ed25519 } from '@noble/curves/ed25519';

const DEFAULT_BASE_URL = process.env.QZD_API_BASE_URL ?? 'http://localhost:3000';
const SIGNING_KEY_HEX =
  process.env.QZD_SIGNING_PRIVATE_KEY ?? '0a3c8c97f7925ea37e46f69af43e219b1d09de89ec1a76cf2ce9a9289a392d5a';
const LOG_DIRECTORY = path.resolve(process.cwd(), 'reports');
const TRANSACTION_COUNT = 1_000;

interface MonetaryAmount {
  currency: string;
  value: string;
}

interface AccountSummary {
  id: string;
  ownerName: string;
}

interface RegisterResponse {
  token: string;
  account: AccountSummary;
  userId: string;
}

interface TransactionResponse {
  id: string;
  accountId: string;
  type: string;
  amount: MonetaryAmount;
  status: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface PreparedSignature {
  headers: Record<string, string>;
  body: string;
  metadata: {
    idempotencyKey: string;
    nonce: string;
    signature: string;
  };
}

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  token?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  expectedStatus?: number | number[];
  signed?: boolean;
}

interface RequestResult<T> {
  status: number;
  data: T;
  rawBody: string;
  signatureMetadata?: PreparedSignature['metadata'];
}

interface LogPayload extends Record<string, unknown> {
  event: string;
  timestamp: string;
}

const textEncoder = new TextEncoder();

function serializeBody(body: unknown): string {
  if (body === undefined) {
    return 'null';
  }
  return JSON.stringify(body ?? null);
}

function createSignaturePayload(
  method: string,
  pathWithQuery: string,
  idempotencyKey: string,
  nonce: string,
  serializedBody: string,
): Uint8Array {
  const canonical = `${method.toUpperCase()}\n${pathWithQuery}\n${idempotencyKey}\n${nonce}\n${serializedBody}`;
  return textEncoder.encode(canonical);
}

function ensurePrivateKeyBytes(hex: string): Uint8Array {
  if (!/^([0-9a-fA-F]{2})+$/.test(hex)) {
    throw new Error('Signing key must be a hex-encoded string.');
  }
  const buffer = Buffer.from(hex, 'hex');
  if (buffer.byteLength !== 32 && buffer.byteLength !== 64) {
    throw new Error('Signing key must represent a 32-byte or 64-byte Ed25519 private key.');
  }
  return new Uint8Array(buffer);
}

const signingKeyBytes = ensurePrivateKeyBytes(SIGNING_KEY_HEX);

function prepareSignedRequest(method: string, pathWithQuery: string, body: unknown): PreparedSignature {
  const idempotencyKey = `idem-${randomUUID()}`;
  const nonce = randomBytes(16).toString('hex');
  const serializedBody = serializeBody(body);
  const payload = createSignaturePayload(method, pathWithQuery, idempotencyKey, nonce, serializedBody);
  const signatureBytes = ed25519.sign(payload, signingKeyBytes);
  const signature = Buffer.from(signatureBytes).toString('hex');

  return {
    headers: {
      'Idempotency-Key': idempotencyKey,
      'X-QZD-Nonce': nonce,
      'X-QZD-Signature': signature,
    },
    body: serializedBody,
    metadata: { idempotencyKey, nonce, signature },
  } satisfies PreparedSignature;
}

async function ensureLogFile(prefix: string): Promise<string> {
  await mkdir(LOG_DIRECTORY, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(LOG_DIRECTORY, `${prefix}-${timestamp}.log`);
}

async function writeLog(logFile: string, event: string, data: Record<string, unknown> = {}): Promise<void> {
  const entry: LogPayload = {
    event,
    timestamp: new Date().toISOString(),
    ...data,
  };
  await appendFile(logFile, `${JSON.stringify(entry)}\n`);
  // eslint-disable-next-line no-console
  console.log(`[${entry.timestamp}] ${event}`, Object.keys(data).length ? data : '');
}

function normalizeExpectedStatuses(expected?: number | number[], defaultStatus = 200): number[] {
  if (!expected) {
    return [defaultStatus];
  }
  return Array.isArray(expected) ? expected : [expected];
}

async function apiRequest<T>(options: RequestOptions): Promise<RequestResult<T>> {
  const method = options.method.toUpperCase() as RequestOptions['method'];
  const url = new URL(options.path, DEFAULT_BASE_URL);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers = new Headers({ Accept: 'application/json' });
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  const shouldSign = options.signed ?? method !== 'GET';
  let requestBody: string | undefined;
  let signatureMetadata: PreparedSignature['metadata'] | undefined;

  if (shouldSign) {
    const pathWithQuery = `${url.pathname}${url.search}`;
    const prepared = prepareSignedRequest(method, pathWithQuery, options.body);
    signatureMetadata = prepared.metadata;
    requestBody = prepared.body;
    headers.set('Idempotency-Key', prepared.headers['Idempotency-Key']);
    headers.set('X-QZD-Nonce', prepared.headers['X-QZD-Nonce']);
    headers.set('X-QZD-Signature', prepared.headers['X-QZD-Signature']);
    if (method !== 'GET') {
      headers.set('Content-Type', 'application/json');
    }
  } else if (method !== 'GET' && options.body !== undefined) {
    requestBody = serializeBody(options.body);
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    method,
    headers,
    body: requestBody,
  });

  const rawBody = await response.text();
  const expectedStatuses = normalizeExpectedStatuses(options.expectedStatus, method === 'POST' ? 201 : 200);
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `Unexpected status ${response.status} for ${method} ${url.pathname}${url.search}: ${rawBody || '<empty>'}`,
    );
  }

  let data: T;
  try {
    data = rawBody ? (JSON.parse(rawBody) as T) : (undefined as T);
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${(error as Error).message}`);
  }

  return { status: response.status, data, rawBody, signatureMetadata };
}

function tokenPreview(token: string): string {
  if (token.length <= 12) {
    return token;
  }
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

function toFixed(value: number): string {
  return value.toFixed(2);
}

function percentile(values: number[], ratio: number): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

async function main(): Promise<void> {
  const logFile = await ensureLogFile('load_test');
  await writeLog(logFile, 'load_test_start', {
    baseUrl: DEFAULT_BASE_URL,
    transactionsPlanned: TRANSACTION_COUNT,
    logFile,
  });

  const runSuffix = Date.now();
  const senderEmail = `loadtest.sender.${runSuffix}@example.com`;
  const receiverEmail = `loadtest.receiver.${runSuffix}@example.com`;
  const password = 'Sup3rS3cret!';

  const senderRegistration = await apiRequest<RegisterResponse>({
    method: 'POST',
    path: '/auth/register',
    body: { email: senderEmail, password, fullName: 'LoadTest Sender' },
    expectedStatus: 201,
  });

  const receiverRegistration = await apiRequest<RegisterResponse>({
    method: 'POST',
    path: '/auth/register',
    body: { email: receiverEmail, password, fullName: 'LoadTest Receiver' },
    expectedStatus: 201,
  });

  await writeLog(logFile, 'account_provisioned', {
    role: 'sender',
    email: senderEmail,
    accountId: senderRegistration.data.account.id,
    userId: senderRegistration.data.userId,
    tokenPreview: tokenPreview(senderRegistration.data.token),
  });

  await writeLog(logFile, 'account_provisioned', {
    role: 'receiver',
    email: receiverEmail,
    accountId: receiverRegistration.data.account.id,
    userId: receiverRegistration.data.userId,
    tokenPreview: tokenPreview(receiverRegistration.data.token),
  });

  const floatValue = toFixed(TRANSACTION_COUNT * 5);
  const cashInBody = {
    accountId: senderRegistration.data.account.id,
    amount: { currency: 'QZD', value: floatValue },
    memo: 'Load test float top-up',
  } as const;

  const cashInStart = performance.now();
  const cashInResponse = await apiRequest<TransactionResponse>({
    method: 'POST',
    path: '/agents/cashin',
    body: cashInBody,
    token: senderRegistration.data.token,
    expectedStatus: 201,
  });
  const cashInDurationMs = performance.now() - cashInStart;

  await writeLog(logFile, 'float_provisioned', {
    transactionId: cashInResponse.data.id,
    amount: cashInResponse.data.amount,
    durationMs: cashInDurationMs.toFixed(2),
  });

  const durations: number[] = [];
  let failures = 0;
  const loadTestStart = performance.now();

  for (let index = 0; index < TRANSACTION_COUNT; index += 1) {
    const amountValue = toFixed(1 + Math.random() * 9);
    const memo = `Load test transfer #${index + 1}`;
    const transferBody = {
      sourceAccountId: senderRegistration.data.account.id,
      destinationAccountId: receiverRegistration.data.account.id,
      amount: { currency: 'QZD', value: amountValue },
      memo,
    } as const;

    const transferStart = performance.now();
    try {
      const transferResponse = await apiRequest<TransactionResponse>({
        method: 'POST',
        path: '/tx/transfer',
        body: transferBody,
        token: senderRegistration.data.token,
        expectedStatus: 202,
      });
      const transferDurationMs = performance.now() - transferStart;
      durations.push(transferDurationMs);

      if ((index + 1) % 50 === 0 || index === 0) {
        await writeLog(logFile, 'transfer_progress', {
          completed: index + 1,
          lastTransactionId: transferResponse.data.id,
          lastDurationMs: transferDurationMs.toFixed(2),
        });
      }
    } catch (error) {
      failures += 1;
      await writeLog(logFile, 'transfer_failed', {
        index: index + 1,
        amount: amountValue,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const totalDurationMs = performance.now() - loadTestStart;
  const successful = durations.length;
  const avgDuration = successful ? durations.reduce((sum, value) => sum + value, 0) / successful : 0;
  const p50 = percentile(durations, 0.5);
  const p95 = percentile(durations, 0.95);

  await writeLog(logFile, 'load_test_complete', {
    attempted: TRANSACTION_COUNT,
    successful,
    failures,
    avgDurationMs: avgDuration.toFixed(2),
    p50DurationMs: p50.toFixed(2),
    p95DurationMs: p95.toFixed(2),
    totalDurationMs: totalDurationMs.toFixed(2),
  });
}

void main().catch(async (error) => {
  const logFile = await ensureLogFile('load_test-error');
  await writeLog(logFile, 'load_test_failed', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exitCode = 1;
});
