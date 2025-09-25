import { useEffect, useState } from 'react';
import { ApiClient } from '@qzd/sdk';

const client = new ApiClient({ baseUrl: 'http://localhost:3000' });

export default function App() {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    client
      .getHealth()
      .then((health) => {
        setMessage(`API is ${health.status}`);
        setStatus('ready');
      })
      .catch(() => {
        setMessage('Unable to reach API');
        setStatus('ready');
      });
  }, []);

  return (
    <main>
      <h1>Wallet</h1>
      <p aria-live="polite">{status === 'loading' ? 'Loading…' : message}</p>
    </main>
  );
}
