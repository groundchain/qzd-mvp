import { useMemo } from 'react';
import { createLedger } from '@qzd/sdk';
import type { LedgerConfig } from '@qzd/sdk';

const ledgerConfig = {
  issuanceThreshold: 1,
  issuanceValidators: [
    {
      id: 'validator-1',
      publicKey: '00'.repeat(66),
    },
  ],
} satisfies LedgerConfig;

export default function App() {
  const entries = useMemo(() => {
    const ledger = createLedger(ledgerConfig);
    const account = ledger.openAccount({ alias: 'system', kyc_level: 'BASIC', public_key: 'system-key' });
    ledger.postEntry({
      type: 'ADJUST',
      amount: 1,
      asset: 'QZD',
      to_account: account.id,
      memo: 'System boot',
    });
    return ledger.getHistory();
  }, []);

  return (
    <main>
      <h1>Admin Console</h1>
      <ul>
        {entries.map((entry) => (
          <li key={entry.tx_hash}>{`${entry.type} ${entry.amount} ${entry.asset}`}</li>
        ))}
      </ul>
    </main>
  );
}
