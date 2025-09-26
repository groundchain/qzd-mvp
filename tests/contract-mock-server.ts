import { createServer, IncomingMessage, ServerResponse } from 'node:http';

const HOST = '127.0.0.1';
const PORT = Number(process.env.CONTRACT_MOCK_PORT ?? 4010);

let serverPromise: Promise<void> | null = null;

export async function ensureContractMockServer(): Promise<void> {
  if (!serverPromise) {
    serverPromise = startServer();
  }

  await serverPromise;
}

async function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (request, response) => {
      try {
        await handleRequest(request, response);
      } catch (error) {
        console.error('Contract mock server encountered an error handling request', error);
        sendJson(response, 500, { message: 'Internal Server Error' });
      }
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        waitForExistingServer().then(resolve).catch(reject);
        return;
      }

      reject(error);
    });

    server.listen(PORT, HOST, () => {
      server.unref();
      resolve();
    });
  });
}

async function waitForExistingServer(): Promise<void> {
  const timeoutAt = Date.now() + 2000;

  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(`http://${HOST}:${PORT}/health/live`);
      if (response.ok) {
        return;
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
