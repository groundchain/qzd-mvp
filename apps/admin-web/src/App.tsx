import { useMemo } from 'react';
import { createLedger, createSigner } from '@qzd/sdk';

export default function App() {
  const entries = useMemo(() => {
    const signer = createSigner();
    const ledger = createLedger<{ event: string }>();
    return [ledger.append({ event: 'system-start' }, signer)];
  }, []);

  return (
    <main>
      <h1>Admin Console</h1>
      <ul>
        {entries.map((entry) => (
          <li key={entry.hash}>{entry.payload.event}</li>
        ))}
      </ul>
    </main>
  );
}
