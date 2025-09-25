import process from 'node:process';

const target = process.env.OAS_MOCK_CHECK_URL ?? 'http://127.0.0.1:4010/health/ready';

async function main() {
  try {
    const response = await fetch(target);
    if (!response.ok) {
      console.error(`Mock server request failed with status ${response.status}`);
      process.exit(1);
    }

    let payload;
    const text = await response.text();
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = text;
    }

    console.log('Mock server request succeeded.');
    console.log('Response payload:', payload);
  } catch (error) {
    console.error('Failed to query Prism mock server.', error);
    process.exit(1);
  }
}

await main();
