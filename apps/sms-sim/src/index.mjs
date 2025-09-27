#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, stderr, exit } from 'node:process';

const args = process.argv.slice(2);
let baseUrl = process.env.SMS_SIM_API_BASE ?? 'http://localhost:3000';
let from = process.env.SMS_SIM_FROM ?? '5025551000';

const usage = () => {
  stdout.write('Usage: pnpm --filter @qzd/sms-sim start -- [--base <url>] [--from <msisdn>]\\n');
  stdout.write('Commands inside the prompt: /from <msisdn>, /base <url>, /quit to exit.\\n');
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  switch (arg) {
    case '--base':
    case '-b': {
      const value = args[i + 1];
      if (!value) {
        stderr.write('Missing value for --base option.\\n');
        usage();
        exit(1);
      }
      baseUrl = value;
      i += 1;
      break;
    }
    case '--from':
    case '-f': {
      const value = args[i + 1];
      if (!value) {
        stderr.write('Missing value for --from option.\\n');
        usage();
        exit(1);
      }
      from = value;
      i += 1;
      break;
    }
    case '--help':
    case '-h': {
      usage();
      exit(0);
    }
    default: {
      if (arg.startsWith('-')) {
        stderr.write(`Unknown option: ${arg}\\n`);
        usage();
        exit(1);
      }
    }
  }
}

const normalizeBaseUrl = (url) => url.endsWith('/') ? url.slice(0, -1) : url;

baseUrl = normalizeBaseUrl(baseUrl);

const rl = createInterface({ input: stdin, output: stdout, terminal: true });

stdout.write(`SMS simulator ready. Forwarding from ${from} to ${baseUrl}/sms/inbound\\n`);
stdout.write('Type an SMS command (BAL, SEND 50 502xxxx, etc.). Prefix with /from or /base to change sender or target.\\n');
stdout.write('Type /quit to exit.\\n');

const sendSms = async (text) => {
  const response = await fetch(`${baseUrl}/sms/inbound`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ from, text }),
  });

  if (!response.ok) {
    const message = await safeReadError(response);
    throw new Error(`API error ${response.status}: ${message}`);
  }

  const data = await response.json();
  if (!data || typeof data.reply !== 'string') {
    throw new Error('Malformed response from API.');
  }
  return data.reply;
};

const safeReadError = async (response) => {
  try {
    const payload = await response.json();
    if (payload && typeof payload.message === 'string') {
      return payload.message;
    }
  } catch {
    // ignore JSON parse errors
  }
  return response.statusText || 'Unknown error';
};

try {
  for await (const line of rl) {
    const input = line.trim();
    if (!input) {
      continue;
    }

    if (input === '/quit' || input === '/exit') {
      break;
    }

    if (input.startsWith('/from ')) {
      const newFrom = input.slice(6).trim();
      if (!newFrom) {
        stdout.write('Usage: /from <msisdn>\\n');
        continue;
      }
      from = newFrom;
      stdout.write(`Sender updated to ${from}.\\n`);
      continue;
    }

    if (input.startsWith('/base ')) {
      const newBase = input.slice(6).trim();
      if (!newBase) {
        stdout.write('Usage: /base <url>\\n');
        continue;
      }
      baseUrl = normalizeBaseUrl(newBase);
      stdout.write(`API base updated to ${baseUrl}.\\n`);
      continue;
    }

    try {
      const reply = await sendSms(input);
      stdout.write(`<< ${reply}\\n`);
    } catch (error) {
      stderr.write(`!! ${error.message ?? error}\\n`);
    }
  }
} finally {
  rl.close();
  stdout.write('Goodbye!\\n');
}
