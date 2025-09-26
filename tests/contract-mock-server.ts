import { createServer, IncomingMessage, ServerResponse, request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';

const HOST = '127.0.0.1';
const REQUESTED_PORT = Number(process.env.CONTRACT_MOCK_PORT ?? 0);

let serverPromise: Promise<string> | null = null;
let resolvedBaseUrl: string | null = process.env.CONTRACT_BASE_URL ?? null;

export async function ensureContractMockServer(): Promise<string> {
  if (resolvedBaseUrl) {
    return resolvedBaseUrl;
  }

  if (!serverPromise) {
    serverPromise = startServer().catch((error) => {
      serverPromise = null;
      throw error;
    });
  }

  resolvedBaseUrl = await serverPromise;
  return resolvedBaseUrl;
}

function getBaseUrl(port: number): string {
  return `http://${HOST}:${port}`;
}

async function startServer(): Promise<string> {
  const existing = await probeExistingServer();
  if (existing) {
    updateEnv(existing.url, existing.port);
    return existing.url;
  }

  return new Promise((resolve, reject) => {
    const server = createServer(async (request, response) => {
      try {
        await handleRequest(request, response);
      } catch (error) {
        console.error('Contract mock server encountered an error handling request', error);
        sendJson(response, 500, { message: 'Internal Server Error' });
      }
    });

    server.on('clientError', (error, socket) => {
      console.error('Contract mock server encountered a client connection error', error);
      socket.destroy();
    });

    let hasRetriedWithRandomPort = false;

    const listen = (port: number) => {
      server.listen(port, HOST, () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          reject(new Error('Unable to determine contract mock server address'));
          return;
        }

        const actualPort = (address as AddressInfo).port;
        const baseUrl = getBaseUrl(actualPort);
        updateEnv(baseUrl, actualPort);

        server.unref();
        resolve(baseUrl);
      });
    };

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' && REQUESTED_PORT !== 0 && !hasRetriedWithRandomPort) {
        hasRetriedWithRandomPort = true;
        probeExistingServer()
          .then((existingServer) => {
            if (existingServer) {
              updateEnv(existingServer.url, existingServer.port);
              resolve(existingServer.url);
              return;
            }

            listen(0);
          })
          .catch((probeError) => {
            console.error('Contract mock server probe failed after EADDRINUSE', probeError);
            listen(0);
          });
        return;
      }

      server.close();
      reject(error);
    });

    listen(REQUESTED_PORT > 0 ? REQUESTED_PORT : 0);
  });
}

async function probeExistingServer(): Promise<{ url: string; port: number } | null> {
  if (REQUESTED_PORT <= 0) {
    return null;
  }

  const baseUrl = getBaseUrl(REQUESTED_PORT);
  const deadline = Date.now() + 2000;

  while (Date.now() < deadline) {
    const isHealthy = await checkHealth(REQUESTED_PORT);
    if (isHealthy) {
      return { url: baseUrl, port: REQUESTED_PORT };
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

function updateEnv(baseUrl: string, port: number): void {
  resolvedBaseUrl = baseUrl;
  process.env.CONTRACT_BASE_URL = baseUrl;
  process.env.CONTRACT_MOCK_PORT = String(port);
}

function checkHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finalize = (value: boolean) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const request = httpRequest(
      {
        host: HOST,
        port,
        path: '/health/live',
        method: 'GET',
        timeout: 250,
      },
      (response) => {
        response.resume();
        const status = response.statusCode ?? 0;
        finalize(status >= 200 && status < 300);
      },
    );

    request.on('timeout', () => {
      request.destroy();
      finalize(false);
    });

    request.on('error', () => {
      finalize(false);
    });

    request.end();
  });
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
