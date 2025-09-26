import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

const HOST = '127.0.0.1';
const REQUESTED_PORT = Number(process.env.CONTRACT_MOCK_PORT ?? 4010);

let serverPromise: Promise<string> | null = null;
let resolvedBaseUrl: string | null = process.env.CONTRACT_BASE_URL ?? null;

export async function ensureContractMockServer(): Promise<string> {
  if (!serverPromise) {
    serverPromise = startServer();
  }

  return serverPromise;
}

function getBaseUrl(port: number): string {
  return `http://${HOST}:${port}`;
}

async function startServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (request, response) => {
      try {
        await handleRequest(request, response);
      } catch (error) {
        console.error('Contract mock server encountered an error handling request', error);
        sendJson(response, 500, { message: 'Internal Server Error' });
      }
    });

    let hasRetriedWithRandomPort = false;

    const listen = (port: number) => {
      server.listen(port, HOST, () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          reject(new Error('Unable to determine contract mock server address'));
          return;
        }

        const baseUrl = getBaseUrl((address as AddressInfo).port);
        resolvedBaseUrl = baseUrl;

        process.env.CONTRACT_BASE_URL = resolvedBaseUrl;
        process.env.CONTRACT_MOCK_PORT = String(address.port);

        server.unref();
        resolve(resolvedBaseUrl);
      });
    };

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' && REQUESTED_PORT !== 0 && !hasRetriedWithRandomPort) {
        hasRetriedWithRandomPort = true;
        waitForExistingServer()
          .then((existingBaseUrl) => {
            resolvedBaseUrl = existingBaseUrl;
            process.env.CONTRACT_BASE_URL = resolvedBaseUrl;
            process.env.CONTRACT_MOCK_PORT = String(REQUESTED_PORT);
            resolve(existingBaseUrl);
          })
          .catch(() => {
            listen(0);
          });
        return;
      }

      reject(error);
    });

    listen(REQUESTED_PORT);
  });
}

async function waitForExistingServer(): Promise<string> {
  if (REQUESTED_PORT === 0) {
    throw new Error('No fixed port configured for contract mock server');
  }

  const timeoutAt = Date.now() + 2000;
  const baseUrl = getBaseUrl(REQUESTED_PORT);

  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(`${baseUrl}/health/live`);
      if (response.ok) {
        return baseUrl;
      }
    } catch {
      // Server might not be ready yet, keep polling.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Timed out waiting for existing contract mock server to become ready');
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const { method = 'GET', url = '' } = request;

  if (method === 'GET' && url === '/health/live') {
    sendJson(response, 200, { status: 'live' });
    return;
  }

  if (method === 'GET' && url === '/health/ready') {
    sendJson(response, 200, {
      status: 'ready',
      dependencies: [
        { name: 'database', status: 'ready' },
        { name: 'messageQueue', status: 'ready' }
      ]
    });
    return;
  }

  if (method === 'POST' && url === '/auth/register') {
    const { email } = (await readJsonBody(request)) ?? {};
    const userId = 'usr_mock_123';

    sendJson(response, 201, {
      userId,
      token: `mock-token-for-${email ?? 'user'}`,
      account: {
        id: 'acct_mock_456',
        ownerId: userId,
        status: 'active',
        createdAt: new Date().toISOString()
      }
    });
    return;
  }

  if (method === 'POST' && url === '/auth/login') {
    await readJsonBody(request);
    sendJson(response, 200, {
      token: 'mock-login-token',
      expiresIn: 3600
    });
    return;
  }

  sendJson(response, 404, { message: 'Not Found' });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawBody) {
    return undefined;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return undefined;
  }
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  response.end(body);
}
