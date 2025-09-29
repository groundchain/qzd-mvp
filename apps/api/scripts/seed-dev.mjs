import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { ed25519 } from '@noble/curves/ed25519';

const DEFAULT_BASE_URL = process.env.QZD_API_BASE_URL ?? 'http://localhost:3000';
const SIGNING_KEY_HEX =
  process.env.QZD_SIGNING_PRIVATE_KEY ?? '0a3c8c97f7925ea37e46f69af43e219b1d09de89ec1a76cf2ce9a9289a392d5a';
const LOG_DIRECTORY = path.resolve(process.cwd(), 'reports');
const DEFAULT_PASSWORD = process.env.QZD_SEED_PASSWORD ?? 'Sup3rS3cret!';
const TREASURY_ISSUANCE_AMOUNT = 1_000_000;

const textEncoder = new TextEncoder();

const SEED_USERS = [
  {
    key: 'treasury',
    role: 'treasury',
    fullName: 'Tesorería QZD',
    email: 'treasury@example.com',
  },
  {
    key: 'juan',
    role: 'individual',
    fullName: 'Juan Pérez',
    email: 'juan@example.com',
  },
  {
    key: 'maria',
    role: 'individual',
    fullName: 'María Gómez',
    email: 'maria@example.com',
  },
  {
    key: 'agent_central',
    role: 'agent',
    fullName: 'Agente Central',
    email: 'agent.central@example.com',
  },
  {
    key: 'agent_north',
    role: 'agent',
    fullName: 'Agente Norte',
    email: 'agent.norte@example.com',
  },
  {
    key: 'merchant_market',
    role: 'merchant',
    fullName: 'Mercado Central',
    email: 'merchant.market@example.com',
  },
  {
    key: 'merchant_cafe',
    role: 'merchant',
    fullName: 'Cafetería Aurora',
    email: 'merchant.cafe@example.com',
  },
];

const VALIDATORS = [
  { id: 'validator-1', name: 'Nodo Norte QZD' },
  { id: 'validator-2', name: 'Nodo Central QZD' },
  { id: 'validator-3', name: 'Nodo Sur QZD' },
];

class ApiError extends Error {
  constructor(message, status, responseBody) {
    super(message);
    this.status = status;
    this.responseBody = responseBody;
  }
}

function serializeBody(body) {
  if (body === undefined) {
    return 'null';
  }
  return JSON.stringify(body ?? null);
}

function createSignaturePayload(method, pathWithQuery, idempotencyKey, nonce, serializedBody) {
  const canonical = `${method.toUpperCase()}\n${pathWithQuery}\n${idempotencyKey}\n${nonce}\n${serializedBody}`;
  return textEncoder.encode(canonical);
}

function ensurePrivateKeyBytes(hex) {
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

function prepareSignedRequest(method, pathWithQuery, body) {
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
  };
}

async function ensureLogFile(prefix) {
  await mkdir(LOG_DIRECTORY, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(LOG_DIRECTORY, `${prefix}-${timestamp}.log`);
}

async function writeLog(logFile, event, data = {}) {
  const entry = {
    event,
    timestamp: new Date().toISOString(),
    ...data,
  };
  const serialized = JSON.stringify(entry);
  await appendFile(logFile, `${serialized}\n`);
  // eslint-disable-next-line no-console
  console.log(`[${entry.timestamp}] ${event}`, Object.keys(data).length ? data : '');
}

function normalizeExpectedStatuses(expected, defaultStatus = 200) {
  if (!expected) {
    return [defaultStatus];
  }
  return Array.isArray(expected) ? expected : [expected];
}

async function apiRequest(options) {
  const method = options.method.toUpperCase();
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
  let requestBody;
  let signatureMetadata;

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
    throw new ApiError(
      `Unexpected status ${response.status} for ${method} ${url.pathname}${url.search}`,
      response.status,
      rawBody,
    );
  }

  let data;
  try {
    data = rawBody ? JSON.parse(rawBody) : undefined;
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error.message}`);
  }

  return { status: response.status, data, rawBody, signatureMetadata };
}

function tokenPreview(token) {
  if (typeof token !== 'string') {
    return '';
  }
  if (token.length <= 12) {
    return token;
  }
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

async function registerUser(spec, logFile) {
  const registration = await apiRequest({
    method: 'POST',
    path: '/auth/register',
    body: { email: spec.email, password: DEFAULT_PASSWORD, fullName: spec.fullName },
    expectedStatus: 201,
  });

  await writeLog(logFile, 'registered_user', {
    role: spec.role,
    email: spec.email,
    accountId: registration.data.account.id,
    userId: registration.data.userId,
    tokenPreview: tokenPreview(registration.data.token),
  });

  return {
    spec,
    token: registration.data.token,
    userId: registration.data.userId,
    account: registration.data.account,
  };
}

async function createIssuance(treasury, logFile) {
  const amountValue = TREASURY_ISSUANCE_AMOUNT.toFixed(2);
  const requestBody = {
    accountId: treasury.account.id,
    amount: { currency: 'QZD', value: amountValue },
    reference: 'Initial treasury issuance',
  };

  const response = await apiRequest({
    method: 'POST',
    path: '/admin/issuance-requests',
    token: treasury.token,
    body: requestBody,
    expectedStatus: 201,
  });

  await writeLog(logFile, 'treasury_issuance_requested', {
    issuanceId: response.data.id,
    amount: requestBody.amount,
    accountId: treasury.account.id,
  });

  return response.data;
}

async function signIssuance(treasury, issuance, validatorId, logFile) {
  const body = { validatorId };

  const response = await apiRequest({
    method: 'POST',
    path: `/admin/issuance-requests/${issuance.id}/sign`,
    token: treasury.token,
    body,
    expectedStatus: 200,
  });

  await writeLog(logFile, 'issuance_signed', {
    issuanceId: issuance.id,
    validatorId,
    collected: response.data.collected,
    status: response.data.status,
  });

  return response.data;
}

async function executeIssuance(treasury, issuanceId, logFile) {
  const response = await apiRequest({
    method: 'POST',
    path: '/tx/issue',
    token: treasury.token,
    body: { requestId: issuanceId },
    expectedStatus: 200,
  });

  await writeLog(logFile, 'issuance_executed', {
    issuanceId,
    transactionId: response.data.id,
    amount: response.data.amount,
    createdAt: response.data.createdAt,
  });

  return response.data;
}

async function getBalance(accountId, token, logFile) {
  const response = await apiRequest({
    method: 'GET',
    path: `/accounts/${accountId}/balance`,
    token,
    expectedStatus: 200,
  });

  await writeLog(logFile, 'balance_snapshot', {
    accountId,
    balance: response.data.total,
  });

  return response.data;
}

async function seedTreasuryIssuance(treasury, logFile) {
  const issuance = await createIssuance(treasury, logFile);
  const signatures = [];
  let updatedIssuance = issuance;

  for (const validator of VALIDATORS) {
    updatedIssuance = await signIssuance(treasury, updatedIssuance, validator.id, logFile);
    signatures.push(validator.id);
  }

  const transaction = await executeIssuance(treasury, updatedIssuance.id, logFile);
  const balance = await getBalance(treasury.account.id, treasury.token, logFile);

  return {
    request: updatedIssuance,
    signatures,
    transaction,
    balance,
  };
}

async function main() {
  const logFile = await ensureLogFile('seed_dev');
  await writeLog(logFile, 'seed_start', {
    baseUrl: DEFAULT_BASE_URL,
    users: SEED_USERS.map((user) => ({ role: user.role, email: user.email })),
    validators: VALIDATORS,
  });

  const registeredUsers = [];

  for (const user of SEED_USERS) {
    const registration = await registerUser(user, logFile);
    registeredUsers.push(registration);
  }

  const treasury = registeredUsers.find((user) => user.spec.role === 'treasury');
  if (!treasury) {
    throw new Error('Treasury user was not created.');
  }

  const issuanceContext = await seedTreasuryIssuance(treasury, logFile);

  await writeLog(logFile, 'seed_complete', {
    treasuryAccountId: treasury.account.id,
    issuanceId: issuanceContext.request.id,
    validatorSignatures: issuanceContext.signatures,
    issuedTransactionId: issuanceContext.transaction.id,
    finalBalance: issuanceContext.balance.total,
  });

  // eslint-disable-next-line no-console
  console.log('\nSeed complete! Summary:');
  // eslint-disable-next-line no-console
  console.table(
    registeredUsers.map((user) => ({
      role: user.spec.role,
      email: user.spec.email,
      account: user.account.id,
      userId: user.userId,
    })),
  );
  // eslint-disable-next-line no-console
  console.log(`Treasury balance: ${issuanceContext.balance.total.value} ${issuanceContext.balance.total.currency}`);
}

main().catch(async (error) => {
  const logFile = await ensureLogFile('seed_dev_error');
  const details = error instanceof ApiError
    ? { message: error.message, status: error.status, body: error.responseBody }
    : { message: error?.message ?? String(error) };
  await writeLog(logFile, 'seed_failed', details);
  console.error('Seeding failed:', error);
  process.exitCode = 1;
});
