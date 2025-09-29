import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { ed25519 } from '@noble/curves/ed25519';

const DEFAULT_BASE_URL = process.env.QZD_API_BASE_URL ?? 'http://localhost:3000';
const SIGNING_KEY_HEX =
  process.env.QZD_SIGNING_PRIVATE_KEY ?? '0a3c8c97f7925ea37e46f69af43e219b1d09de89ec1a76cf2ce9a9289a392d5a';
const LOG_DIRECTORY = path.resolve(process.cwd(), 'reports');

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

interface QuoteResponse {
  quoteId: string;
  sellAmount: MonetaryAmount;
  buyAmount: MonetaryAmount;
  rate: string;
  expiresAt: string;
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

interface VoucherResponse {
  code: string;
  accountId: string;
  amount: MonetaryAmount;
  fee?: MonetaryAmount;
  totalDebited?: MonetaryAmount;
  status: string;
  createdAt: string;
}

interface BalanceResponse {
  accountId: string;
  total: MonetaryAmount;
  available?: MonetaryAmount;
  updatedAt: string;
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
  const serialized = JSON.stringify(entry);
  await appendFile(logFile, `${serialized}\n`);
  const consoleDetails = { ...data };
  if (typeof consoleDetails.tokenPreview === 'string') {
    consoleDetails.tokenPreview = consoleDetails.tokenPreview;
  }
  // eslint-disable-next-line no-console
  console.log(`[${entry.timestamp}] ${event}`, Object.keys(consoleDetails).length ? consoleDetails : '');
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

async function main(): Promise<void> {
  const logFile = await ensureLogFile('demo_us_to_gt');
  await writeLog(logFile, 'demo_start', { baseUrl: DEFAULT_BASE_URL, logFile });

  const runSuffix = Date.now();
  const juanEmail = `juan.${runSuffix}@example.com`;
  const mariaEmail = `maria.${runSuffix}@example.com`;
  const password = 'Sup3rS3cret!';

  const juanRegistration = await apiRequest<RegisterResponse>({
    method: 'POST',
    path: '/auth/register',
    body: { email: juanEmail, password, fullName: 'Juan Pérez' },
    expectedStatus: 201,
  });

  await writeLog(logFile, 'registered_user', {
    role: 'sender',
    email: juanEmail,
    accountId: juanRegistration.data.account.id,
    userId: juanRegistration.data.userId,
    tokenPreview: tokenPreview(juanRegistration.data.token),
  });

  const mariaRegistration = await apiRequest<RegisterResponse>({
    method: 'POST',
    path: '/auth/register',
    body: { email: mariaEmail, password, fullName: 'María Gómez' },
    expectedStatus: 201,
  });

  await writeLog(logFile, 'registered_user', {
    role: 'beneficiary',
    email: mariaEmail,
    accountId: mariaRegistration.data.account.id,
    userId: mariaRegistration.data.userId,
    tokenPreview: tokenPreview(mariaRegistration.data.token),
  });

  const quoteResponse = await apiRequest<QuoteResponse>({
    method: 'GET',
    path: '/simulate/quote',
    token: juanRegistration.data.token,
    query: { usdAmount: '100.00' },
    expectedStatus: 200,
    signed: false,
  });

  await writeLog(logFile, 'quote_previewed', {
    quoteId: quoteResponse.data.quoteId,
    sellAmount: quoteResponse.data.sellAmount,
    buyAmount: quoteResponse.data.buyAmount,
    rate: quoteResponse.data.rate,
    expiresAt: quoteResponse.data.expiresAt,
  });

  const acquisitionBody = {
    usdAmount: { currency: 'USD', value: '100.00' },
    senderPhone: '+12065550100',
    receiverAccountId: mariaRegistration.data.account.id,
  } as const;

  const acquireStart = performance.now();
  const acquisitionResponse = await apiRequest<TransactionResponse>({
    method: 'POST',
    path: '/remit/us/acquire-qzd',
    body: acquisitionBody,
    token: juanRegistration.data.token,
    expectedStatus: 202,
  });
  const acquireDurationMs = performance.now() - acquireStart;

  await writeLog(logFile, 'qzd_acquired', {
    transactionId: acquisitionResponse.data.id,
    beneficiaryAccount: acquisitionResponse.data.accountId,
    amount: acquisitionResponse.data.amount,
    status: acquisitionResponse.data.status,
    metadata: acquisitionResponse.data.metadata,
    durationMs: acquireDurationMs.toFixed(2),
  });

  const mariaBalanceAfterIssuance = await apiRequest<BalanceResponse>({
    method: 'GET',
    path: `/accounts/${mariaRegistration.data.account.id}/balance`,
    token: mariaRegistration.data.token,
    expectedStatus: 200,
    signed: false,
  });

  await writeLog(logFile, 'balance_snapshot', {
    accountId: mariaBalanceAfterIssuance.data.accountId,
    total: mariaBalanceAfterIssuance.data.total,
    context: 'post_issuance',
  });

  const mintedValue = Number.parseFloat(acquisitionResponse.data.amount.value);
  const partialCashoutValue = (() => {
    if (!Number.isFinite(mintedValue) || mintedValue <= 1) {
      return 1;
    }
    const half = Number((mintedValue / 2).toFixed(2));
    if (half >= mintedValue) {
      return Number((mintedValue - 1).toFixed(2));
    }
    return Math.max(1, half);
  })();

  const cashoutBody = {
    accountId: mariaRegistration.data.account.id,
    amount: { currency: 'QZD', value: toFixed(partialCashoutValue) },
    memo: 'Partial cash-out for family needs',
  } as const;

  const cashoutStart = performance.now();
  const cashoutResponse = await apiRequest<VoucherResponse>({
    method: 'POST',
    path: '/agents/cashout',
    body: cashoutBody,
    token: mariaRegistration.data.token,
    expectedStatus: 201,
  });
  const cashoutDurationMs = performance.now() - cashoutStart;

  await writeLog(logFile, 'cashout_issued', {
    voucherCode: cashoutResponse.data.code,
    amount: cashoutResponse.data.amount,
    fee: cashoutResponse.data.fee,
    totalDebited: cashoutResponse.data.totalDebited,
    status: cashoutResponse.data.status,
    durationMs: cashoutDurationMs.toFixed(2),
  });

  const mariaBalanceAfterCashout = await apiRequest<BalanceResponse>({
    method: 'GET',
    path: `/accounts/${mariaRegistration.data.account.id}/balance`,
    token: mariaRegistration.data.token,
    expectedStatus: 200,
    signed: false,
  });

  await writeLog(logFile, 'balance_snapshot', {
    accountId: mariaBalanceAfterCashout.data.accountId,
    total: mariaBalanceAfterCashout.data.total,
    context: 'post_cashout',
  });

  const parsedFee = cashoutResponse.data.fee ? Number.parseFloat(cashoutResponse.data.fee.value) : 0;
  const safeFee = Number.isFinite(parsedFee) ? parsedFee : 0;
  const estimatedRemaining =
    Number.isFinite(mintedValue) && Number.isFinite(partialCashoutValue)
      ? Math.max(0, mintedValue - partialCashoutValue - safeFee)
      : 0;
  let merchantAmountCandidate = Number.isFinite(mintedValue)
    ? Number((mintedValue * 0.1).toFixed(2))
    : Number.NaN;
  const maxAvailable = Number.isFinite(estimatedRemaining) && estimatedRemaining > 0 ? estimatedRemaining : mintedValue;
  if (!Number.isFinite(merchantAmountCandidate) || merchantAmountCandidate <= 0 || !Number.isFinite(maxAvailable)) {
    merchantAmountCandidate = Math.max(1, Number.isFinite(maxAvailable) ? Math.min(75, maxAvailable) : 50);
  } else if (merchantAmountCandidate > maxAvailable) {
    merchantAmountCandidate = Math.max(1, Math.min(75, maxAvailable));
  }
  const merchantAmountValue = Number(merchantAmountCandidate.toFixed(2));
  if (!Number.isFinite(merchantAmountValue) || merchantAmountValue <= 0) {
    throw new Error('Unable to determine a merchant payment amount within available balance.');
  }

  const merchantPaymentBody = {
    sourceAccountId: mariaRegistration.data.account.id,
    destinationAccountId: juanRegistration.data.account.id,
    amount: { currency: 'QZD', value: toFixed(merchantAmountValue) },
    memo: 'Merchant payment for school supplies',
  } as const;

  const merchantStart = performance.now();
  const merchantPaymentResponse = await apiRequest<TransactionResponse>({
    method: 'POST',
    path: '/tx/transfer',
    body: merchantPaymentBody,
    token: mariaRegistration.data.token,
    expectedStatus: 202,
  });
  const merchantDurationMs = performance.now() - merchantStart;

  await writeLog(logFile, 'merchant_payment_initiated', {
    transactionId: merchantPaymentResponse.data.id,
    status: merchantPaymentResponse.data.status,
    amount: merchantPaymentResponse.data.amount,
    memo: merchantPaymentBody.memo,
    durationMs: merchantDurationMs.toFixed(2),
  });

  await writeLog(logFile, 'demo_complete', {
    voucherCode: cashoutResponse.data.code,
    merchantTransactionId: merchantPaymentResponse.data.id,
  });
}

void main().catch(async (error) => {
  const logFile = await ensureLogFile('demo_us_to_gt-error');
  await writeLog(logFile, 'demo_failed', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exitCode = 1;
});
