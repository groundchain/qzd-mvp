import {
  applyMutationSecurityHeaders,
  createMutationSecurityHeaders,
} from '../../../packages/shared/src/request-security.ts';

const apiBase = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:3000';
const normalizedApiBase = apiBase.replace(/\/$/, '');

const signedMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type RegisterResponse = {
  account?: { id?: string | null } | null;
  token?: string | null;
};

type SignedFetchOptions = {
  method?: string;
  body?: unknown;
};

type RegisteredUser = {
  email: string;
  password: string;
  accountId: string;
};

function createHeaders(body: unknown): { headers: Headers; bodyText: string | undefined } {
  const headers = new Headers({ Accept: 'application/json' });
  let bodyText: string | undefined;

  if (body !== undefined) {
    bodyText = JSON.stringify(body);
    headers.set('Content-Type', 'application/json');
  }

  return { headers, bodyText };
}

export async function signedJsonFetch<TResponse>(path: string, options: SignedFetchOptions = {}) {
  const method = (options.method ?? 'GET').toUpperCase();
  const url = new URL(path, normalizedApiBase);
  const { headers, bodyText } = createHeaders(options.body);

  if (signedMethods.has(method)) {
    const securityHeaders = createMutationSecurityHeaders(
      method,
      `${url.pathname}${url.search}`,
      options.body ?? null,
    );
    applyMutationSecurityHeaders(headers, securityHeaders);
  }

  const response = await fetch(url, {
    method,
    headers,
    body: bodyText,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Request failed: ${method} ${url.toString()} → ${response.status} ${response.statusText} — ${errorBody}`,
    );
  }

  const raw = await response.text();
  return raw ? (JSON.parse(raw) as TResponse) : (undefined as TResponse);
}

export async function registerUser(prefix: string): Promise<RegisteredUser> {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `${prefix}-${unique}@example.com`;
  const password = `Pw-${unique}`;
  const fullName = `${prefix.replace(/[-_]+/g, ' ')} Smoke`;

  const payload = await signedJsonFetch<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, fullName },
  });

  const accountId = payload.account?.id;
  if (!accountId) {
    throw new Error('Registration response did not include an account id');
  }

  return { email, password, accountId };
}

export type { RegisteredUser };
