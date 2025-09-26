import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AccountsApi,
  AuthApi,
  Configuration,
  RemittancesApi,
  TransactionsApi,
  type Balance,
  type MonetaryAmount,
  type QuoteResponse,
  type Transaction,
} from '@qzd/sdk-browser';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const QUOTE_SCENARIOS = ['DEFAULT', 'SUBSIDIZED', 'TARIFFED'] as const;

type QuoteScenario = (typeof QUOTE_SCENARIOS)[number];

type AsyncStatus = 'idle' | 'pending';

function sanitizeBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_API_BASE_URL;
  }
  return trimmed.replace(/\/+$/, '');
}

function formatAmount(amount: MonetaryAmount | undefined): string {
  if (!amount) {
    return '—';
  }
  return `${amount.value} ${amount.currency}`;
}

function formatTimestamp(timestamp: Date | string | undefined): string {
  if (!timestamp) {
    return '—';
  }

  const asDate = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(asDate.getTime())) {
    return String(timestamp);
  }

  return asDate.toLocaleString();
}

export default function App() {
  const configuredBaseUrl = sanitizeBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined);
  const [token, setToken] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [accountIdInput, setAccountIdInput] = useState('');
  const [accountId, setAccountId] = useState('');
  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accountStatus, setAccountStatus] = useState<AsyncStatus>('idle');
  const [transferDestination, setTransferDestination] = useState('');
  const [transferAmount, setTransferAmount] = useState('1.00');
  const [transferCurrency, setTransferCurrency] = useState('QZD');
  const [transferMemo, setTransferMemo] = useState('');
  const [transferStatus, setTransferStatus] = useState<AsyncStatus>('idle');
  const [quoteScenario, setQuoteScenario] = useState<QuoteScenario>('DEFAULT');
  const [quoteAmount, setQuoteAmount] = useState('100.00');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<AsyncStatus>('idle');

  const configuration = useMemo(
    () =>
      new Configuration({
        basePath: configuredBaseUrl,
        accessToken: token ? async () => token : undefined,
      }),
    [configuredBaseUrl, token],
  );

  const authApi = useMemo(() => new AuthApi(configuration), [configuration]);
  const accountsApi = useMemo(() => new AccountsApi(configuration), [configuration]);
  const transactionsApi = useMemo(() => new TransactionsApi(configuration), [configuration]);
  const remittancesApi = useMemo(() => new RemittancesApi(configuration), [configuration]);

  const resetStatus = useCallback((message: string | null) => {
    setStatusMessage(message);
  }, []);

  const refreshAccountData = useCallback(
    async (id: string) => {
      if (!id || !token) {
        setBalance(null);
        setTransactions([]);
        return;
      }

      setAccountStatus('pending');
      try {
        const [balanceResponse, transactionsResponse] = await Promise.all([
          accountsApi.getAccountBalance({ id }),
          transactionsApi.listAccountTransactions({ id, limit: 25 }),
        ]);

        setBalance(balanceResponse);
        setTransactions(transactionsResponse.items ?? []);
        resetStatus(null);
      } catch (error) {
        console.error('Failed to refresh account data', error);
        resetStatus('Unable to load account data. Check your credentials and account ID.');
        setBalance(null);
        setTransactions([]);
      } finally {
        setAccountStatus('idle');
      }
    },
    [accountsApi, transactionsApi, token, resetStatus],
  );

  useEffect(() => {
    if (accountId && token) {
      void refreshAccountData(accountId);
    }
  }, [accountId, token, refreshAccountData]);

  const handleRegister = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get('register-email') ?? '').trim();
      const password = String(formData.get('register-password') ?? '').trim();
      const fullName = String(formData.get('register-name') ?? '').trim();

      if (!email || !password || !fullName) {
        resetStatus('All registration fields are required.');
        return;
      }

      try {
        const response = await authApi.registerUser({
          registerUserRequest: { email, password, fullName },
        });

        const sessionToken = response.token ?? null;
        const newAccountId = response.account?.id ?? '';

        setToken(sessionToken);
        setAccountIdInput(newAccountId);
        setAccountId(newAccountId);
        resetStatus(
          sessionToken
            ? 'Registration successful. You are now signed in.'
            : 'Registration successful. Please log in.',
        );
      } catch (error) {
        console.error('Registration failed', error);
        resetStatus('Registration failed. Please try again.');
      }
    },
    [authApi, resetStatus],
  );

  const handleLogin = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get('login-email') ?? '').trim();
      const password = String(formData.get('login-password') ?? '').trim();

      if (!email || !password) {
        resetStatus('Email and password are required to sign in.');
        return;
      }

      try {
        const response = await authApi.loginUser({ loginUserRequest: { email, password } });
        const sessionToken = response.token ?? null;
        if (!sessionToken) {
          resetStatus('Login response did not include a session token.');
          return;
        }

        setToken(sessionToken);
        resetStatus('Logged in successfully.');
      } catch (error) {
        console.error('Login failed', error);
        resetStatus('Login failed. Check your credentials.');
      }
    },
    [authApi, resetStatus],
  );

  const handleAccountSelection = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextId = accountIdInput.trim();
      setAccountId(nextId);
      if (nextId) {
        resetStatus(null);
      }
    },
    [accountIdInput, resetStatus],
  );

  const handleSendTransfer = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!token) {
        resetStatus('You must be logged in to send a transfer.');
        return;
      }

      if (!accountId) {
        resetStatus('Set the source account ID before sending a transfer.');
        return;
      }

      const destination = transferDestination.trim();
      const amountValue = transferAmount.trim();
      const currency = transferCurrency.trim() || 'QZD';
      const memo = transferMemo.trim();

      if (!destination || !amountValue) {
        resetStatus('Destination account and amount are required.');
        return;
      }

      setTransferStatus('pending');
      try {
        await transactionsApi.initiateTransfer({
          transferRequest: {
            sourceAccountId: accountId,
            destinationAccountId: destination,
            amount: { currency, value: amountValue },
            memo: memo || undefined,
          },
        });

        resetStatus('Transfer submitted successfully.');
        setTransferMemo('');
        await refreshAccountData(accountId);
      } catch (error) {
        console.error('Transfer failed', error);
        resetStatus('Transfer failed. Review the details and try again.');
      } finally {
        setTransferStatus('idle');
      }
    },
    [
      accountId,
      refreshAccountData,
      resetStatus,
      token,
      transferAmount,
      transferCurrency,
      transferDestination,
      transferMemo,
      transactionsApi,
    ],
  );

  const handlePreviewQuote = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!token) {
        resetStatus('Log in to request a quote.');
        return;
      }

      const amount = quoteAmount.trim();
      if (!amount) {
        resetStatus('Enter the USD amount you would like to convert.');
        return;
      }

      setQuoteStatus('pending');
      try {
        const response = await remittancesApi.simulateQuote({ usdAmount: amount, scenario: quoteScenario });
        setQuote(response);
        resetStatus(null);
      } catch (error) {
        console.error('Quote request failed', error);
        resetStatus('Unable to fetch quote. Try again later.');
        setQuote(null);
      } finally {
        setQuoteStatus('idle');
      }
    },
    [quoteAmount, quoteScenario, remittancesApi, resetStatus, token],
  );

  return (
    <main className="app-shell">
      <header>
        <h1>QZD Wallet</h1>
        <p>
          API base URL: <code>{configuredBaseUrl}</code>
        </p>
        {token ? <p role="status">Session active.</p> : <p role="status">Not signed in.</p>}
        {statusMessage && (
          <p className="status" aria-live="polite">
            {statusMessage}
          </p>
        )}
      </header>

      <section aria-labelledby="auth-section">
        <h2 id="auth-section">Authentication</h2>
        <div className="panel">
          <form onSubmit={handleRegister} className="auth-form">
            <h3>Register</h3>
            <label>
              Email
              <input name="register-email" type="email" autoComplete="email" required />
            </label>
            <label>
              Password
              <input name="register-password" type="password" autoComplete="new-password" required />
            </label>
            <label>
              Full name
              <input name="register-name" type="text" autoComplete="name" required />
            </label>
            <button type="submit">Register</button>
          </form>

          <form onSubmit={handleLogin} className="auth-form">
            <h3>Log in</h3>
            <label>
              Email
              <input name="login-email" type="email" autoComplete="email" required />
            </label>
            <label>
              Password
              <input name="login-password" type="password" autoComplete="current-password" required />
            </label>
            <button type="submit">Sign in</button>
          </form>
        </div>
      </section>

      <section aria-labelledby="account-section">
        <h2 id="account-section">Account</h2>
        <form onSubmit={handleAccountSelection} className="account-form">
          <label>
            Account ID
            <input
              value={accountIdInput}
              onChange={(event) => setAccountIdInput(event.target.value)}
              placeholder="acct_..."
            />
          </label>
          <button type="submit">Load account</button>
        </form>

        <div className="account-details">
          <h3>Balance</h3>
          {accountStatus === 'pending' && <p aria-live="polite">Loading account data…</p>}
          {!accountId && <p>Set an account ID to view balances.</p>}
          {accountId && !balance && accountStatus === 'idle' && <p>No balance information available.</p>}
          {balance && (
            <dl>
              <div>
                <dt>Available</dt>
                <dd>{formatAmount(balance.available)}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{formatAmount(balance.total)}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatTimestamp(balance.updatedAt)}</dd>
              </div>
            </dl>
          )}
        </div>

        <div className="transactions">
          <h3>Recent transactions</h3>
          {transactions.length === 0 ? (
            <p>No transactions to display.</p>
          ) : (
            <ul>
              {transactions.map((transaction) => (
                <li key={transaction.id}>
                  <strong>{transaction.type}</strong> · {formatAmount(transaction.amount)} · {transaction.status}{' '}
                  · {formatTimestamp(transaction.createdAt)}
                  {transaction.counterpartyAccountId && (
                    <>
                      {' '}
                      · Counterparty: {transaction.counterpartyAccountId}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="transfer-section">
        <h2 id="transfer-section">Send transfer</h2>
        <form onSubmit={handleSendTransfer} className="transfer-form">
          <label>
            Destination account
            <input value={transferDestination} onChange={(event) => setTransferDestination(event.target.value)} required />
          </label>
          <label>
            Currency
            <input value={transferCurrency} onChange={(event) => setTransferCurrency(event.target.value)} />
          </label>
          <label>
            Amount
            <input value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} required />
          </label>
          <label>
            Memo
            <input value={transferMemo} onChange={(event) => setTransferMemo(event.target.value)} placeholder="Optional" />
          </label>
          <button type="submit" disabled={transferStatus === 'pending'}>
            {transferStatus === 'pending' ? 'Sending…' : 'Send transfer'}
          </button>
        </form>
      </section>

      <section aria-labelledby="quote-section">
        <h2 id="quote-section">Preview quote</h2>
        <form onSubmit={handlePreviewQuote} className="quote-form">
          <label>
            USD amount
            <input value={quoteAmount} onChange={(event) => setQuoteAmount(event.target.value)} required />
          </label>
          <fieldset>
            <legend>Scenario</legend>
            {QUOTE_SCENARIOS.map((scenario) => (
              <label key={scenario}>
                <input
                  type="radio"
                  name="quote-scenario"
                  value={scenario}
                  checked={quoteScenario === scenario}
                  onChange={() => setQuoteScenario(scenario)}
                />
                {scenario}
              </label>
            ))}
          </fieldset>
          <button type="submit" disabled={quoteStatus === 'pending'}>
            {quoteStatus === 'pending' ? 'Fetching…' : 'Preview quote'}
          </button>
        </form>

        {quote && (
          <div className="quote-details">
            <h3>Quote details</h3>
            <dl>
              <div>
                <dt>Quote ID</dt>
                <dd>{quote.quoteId}</dd>
              </div>
              <div>
                <dt>Sell amount</dt>
                <dd>{formatAmount(quote.sellAmount)}</dd>
              </div>
              <div>
                <dt>Buy amount</dt>
                <dd>{formatAmount(quote.buyAmount)}</dd>
              </div>
              <div>
                <dt>Rate</dt>
                <dd>{quote.rate}</dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>{formatTimestamp(quote.expiresAt)}</dd>
              </div>
            </dl>
          </div>
        )}
      </section>
    </main>
  );
}
