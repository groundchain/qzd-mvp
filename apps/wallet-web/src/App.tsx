import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  AccountsApi,
  AuthApi,
  Configuration,
  RemittancesApi,
  TransactionsApi,
  OfflineApi,
  type Balance,
  type MonetaryAmount,
  type QuoteResponse,
  type Transaction,
  type OfflineVoucher,
} from '@qzd/sdk-browser';
import {
  DEFAULT_DEV_SIGNING_PRIVATE_KEY_HEX,
  createIdempotencyKey,
  createSignedFetch,
} from '@qzd/shared/request-security';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const QUOTE_SCENARIOS = ['DEFAULT', 'TARIFFED', 'SUBSIDIZED'] as const;

type QuoteScenario = (typeof QUOTE_SCENARIOS)[number];

type AsyncStatus = 'idle' | 'pending';

const SIGNING_PRIVATE_KEY =
  (import.meta.env.VITE_SIGNING_PRIVATE_KEY as string | undefined)?.trim() ??
  (import.meta.env.DEV ? DEFAULT_DEV_SIGNING_PRIVATE_KEY_HEX : undefined);
const SIGNED_FETCH = createSignedFetch(SIGNING_PRIVATE_KEY);

function sanitizeBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_API_BASE_URL;
  }
  return trimmed.replace(/\/+$/, '');
}

function formatAmount(amount: MonetaryAmount | undefined): string {
  if (!amount) {
    return '\\u2014';
  }
  return `${amount.value} ${amount.currency}`;
}

function formatTimestamp(timestamp: Date | string | undefined): string {
  if (!timestamp) {
    return '\\u2014';
  }

  const asDate = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(asDate.getTime())) {
    return String(timestamp);
  }

  return asDate.toLocaleString();
}

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

function LoadingIndicator({ label }: { label: string }) {
  return (
    <span className="loading-indicator" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}
    </span>
  );
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
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [transferDestination, setTransferDestination] = useState('');
  const [transferAmount, setTransferAmount] = useState('1.00');
  const [transferCurrency, setTransferCurrency] = useState('QZD');
  const [transferMemo, setTransferMemo] = useState('');
  const [transferStatus, setTransferStatus] = useState<AsyncStatus>('idle');
  const [quoteScenario, setQuoteScenario] = useState<QuoteScenario>('DEFAULT');
  const [quoteAmount, setQuoteAmount] = useState('100.00');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteScenarioResult, setQuoteScenarioResult] = useState<QuoteScenario | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<AsyncStatus>('idle');
  const [offlineVoucherInput, setOfflineVoucherInput] = useState('');
  const [offlineVoucherStatus, setOfflineVoucherStatus] = useState<AsyncStatus>('idle');
  const [redeemedOfflineVoucher, setRedeemedOfflineVoucher] = useState<OfflineVoucher | null>(null);

  const configuration = useMemo(
    () =>
      new Configuration({
        basePath: configuredBaseUrl,
        accessToken: token ? async () => token : undefined,
        fetchApi: SIGNED_FETCH,
      }),
    [configuredBaseUrl, token],
  );

  const authApi = useMemo(() => new AuthApi(configuration), [configuration]);
  const accountsApi = useMemo(() => new AccountsApi(configuration), [configuration]);
  const transactionsApi = useMemo(() => new TransactionsApi(configuration), [configuration]);
  const remittancesApi = useMemo(() => new RemittancesApi(configuration), [configuration]);
  const offlineApi = useMemo(() => new OfflineApi(configuration), [configuration]);

  const resetStatus = useCallback((message: string | null) => {
    setStatusMessage(message);
  }, []);

  useEffect(() => {
    if (!quote && quoteScenarioResult !== null) {
      setQuoteScenarioResult(null);
    }
  }, [quote, quoteScenarioResult]);

  const refreshAccountData = useCallback(
    async (id: string) => {
      if (!id || !token) {
        setBalance(null);
        setTransactions([]);
        setAccountLoaded(false);
        return;
      }

      setAccountStatus('pending');
      setAccountLoaded(false);
      try {
        const [balanceResponse, transactionsResponse] = await Promise.all([
          accountsApi.getAccountBalance({ id }),
          transactionsApi.listAccountTransactions({ id, limit: 25 }),
        ]);

        setBalance(balanceResponse);
        setTransactions(transactionsResponse.items ?? []);
        setAccountLoaded(true);
        resetStatus(null);
      } catch (error) {
        console.error('Failed to refresh account data', error);
        resetStatus('Unable to load account data. Check your credentials and account ID.');
        setBalance(null);
        setTransactions([]);
        setAccountLoaded(false);
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
          idempotencyKey: createIdempotencyKey(),
          registerUserRequest: { email, password, fullName },
        });

        const sessionToken = response.token ?? null;
        const newAccountId = response.account?.id ?? '';

        setToken(sessionToken);
        setAccountIdInput(newAccountId);
        setAccountId(newAccountId);
        setAccountLoaded(false);
        resetStatus(
          sessionToken
            ? 'Registration successful. You are now signed in.'
            : 'Registration successful. Please log in.',
        );
      } catch (error) {
        console.error('Registration failed', error);
        resetStatus(error instanceof Error ? error.message : 'Registration failed.');
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
        const response = await authApi.loginUser({
          idempotencyKey: createIdempotencyKey(),
          loginUserRequest: { email, password },
        });
        const sessionToken = response.token ?? null;
        if (!sessionToken) {
          resetStatus('Login response did not include a session token.');
          return;
        }

        setToken(sessionToken);
        setAccountLoaded(false);
        resetStatus('Logged in successfully.');
      } catch (error) {
        console.error('Login failed', error);
        resetStatus(error instanceof Error ? error.message : 'Login failed.');
      }
    },
    [authApi, resetStatus],
  );

  const handleRedeemOfflineVoucher = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!token) {
        resetStatus('Sign in before redeeming offline vouchers.');
        return;
      }

      const rawInput = offlineVoucherInput.trim();
      if (!rawInput) {
        resetStatus('Paste an offline voucher payload to redeem.');
        return;
      }

      setRedeemedOfflineVoucher(null);

      let offlineVoucherPayload: OfflineVoucher;
      try {
        const parsed = JSON.parse(rawInput) as Record<string, unknown>;
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Offline voucher payload must be a JSON object.');
        }
        const base = parsed as Partial<OfflineVoucher>;
        const candidate = {
          ...base,
          status:
            typeof base.status === 'string' && base.status.trim()
              ? (base.status as OfflineVoucher['status'])
              : 'pending',
        } as OfflineVoucher;
        if (
          typeof candidate.id !== 'string' ||
          typeof candidate.fromCardId !== 'string' ||
          typeof candidate.toAccountId !== 'string'
        ) {
          throw new Error('Offline voucher is missing required identifiers.');
        }
        if (
          !candidate.amount ||
          typeof candidate.amount.value !== 'string' ||
          typeof candidate.amount.currency !== 'string'
        ) {
          throw new Error('Offline voucher amount must include currency and value.');
        }
        if (typeof candidate.nonce !== 'string' || typeof candidate.signature !== 'string') {
          throw new Error('Offline voucher nonce and signature are required.');
        }
        if (typeof candidate.expiresAt !== 'string') {
          throw new Error('Offline voucher expiration must be provided.');
        }
        offlineVoucherPayload = candidate;
      } catch (error) {
        console.error('Failed to parse offline voucher payload', error);
        resetStatus(
          error instanceof Error ? error.message : 'Invalid offline voucher payload.',
        );
        return;
      }

      setOfflineVoucherStatus('pending');
      try {
        const createdVoucher = await offlineApi.createOfflineVoucher({
          idempotencyKey: createIdempotencyKey(),
          offlineVoucher: offlineVoucherPayload,
        });
        const voucherId = createdVoucher.id ?? offlineVoucherPayload.id;
        if (!voucherId) {
          throw new Error('Voucher registration succeeded without returning an id.');
        }

        const redeemedVoucher = await offlineApi.redeemOfflineVoucher({
          id: voucherId,
          idempotencyKey: createIdempotencyKey(),
        });
        setRedeemedOfflineVoucher(redeemedVoucher);
        resetStatus(`Offline voucher ${voucherId} redeemed successfully.`);
      } catch (error) {
        console.error('Failed to redeem offline voucher', error);
        resetStatus(
          error instanceof Error ? error.message : 'Unable to redeem offline voucher.',
        );
      } finally {
        setOfflineVoucherStatus('idle');
      }
    },
    [offlineApi, offlineVoucherInput, resetStatus, token],
  );

  const handleAccountSelection = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextId = accountIdInput.trim();
      setAccountId(nextId);
      setAccountLoaded(false);
      setBalance(null);
      setTransactions([]);
      if (nextId) {
        resetStatus(null);
      }
    },
    [accountIdInput, resetStatus],
  );

  const handleSendTransfer = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!token || !accountId) {
        resetStatus('Load an account before sending funds.');
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
          idempotencyKey: createIdempotencyKey(),
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
        resetStatus(error instanceof Error ? error.message : 'Transfer failed.');
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
      if (!token || !accountLoaded) {
        resetStatus('Load an account before requesting a quote.');
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
        setQuoteScenarioResult(quoteScenario);
        resetStatus(null);
      } catch (error) {
        console.error('Quote request failed', error);
        resetStatus(error instanceof Error ? error.message : 'Unable to fetch quote.');
        setQuote(null);
        setQuoteScenarioResult(null);
      } finally {
        setQuoteStatus('idle');
      }
    },
    [accountLoaded, quoteAmount, quoteScenario, remittancesApi, resetStatus, token],
  );

  const transferDestinationValid = transferDestination.trim().length > 0;
  const transferAmountValid = transferAmount.trim().length > 0;
  const canUseAccountActions = Boolean(token && accountLoaded);
  const canSubmitTransfer =
    canUseAccountActions && transferDestinationValid && transferAmountValid && transferStatus !== 'pending';
  const canPreviewQuote = canUseAccountActions && quoteStatus !== 'pending';
  const canRedeemOfflineVoucher = canUseAccountActions && offlineVoucherStatus !== 'pending';
  const scenarioToggleDisabled = !canUseAccountActions || quoteStatus === 'pending';
  const isAuthenticated = Boolean(token);
  const navLinks = [
    { href: '#auth-section', label: 'Register / Log in' },
    { href: '#account-section', label: 'Account tools' },
    { href: '#balance-section', label: 'Balance' },
    { href: '#transactions-section', label: 'Transactions' },
    { href: '#transfer-section', label: 'Send transfer' },
    { href: '#quote-section', label: 'Preview quote' },
    { href: '#offline-section', label: 'Redeem offline voucher' },
  ];

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="app-header">
        <div className="container">
          <div>
            <h1 className="app-title">QZD Wallet</h1>
            <p className="app-subtitle">
              Manage sandbox balances, send transfers, preview quotes, and redeem offline vouchers.
            </p>
          </div>
          <div className="session-meta">
            <span className="session-pill" data-status={isAuthenticated ? 'active' : 'inactive'}>
              {isAuthenticated ? 'Session active' : 'Not signed in'}
            </span>
            <span>
              API base URL: <code className="code-inline">{configuredBaseUrl}</code>
            </span>
          </div>
          {statusMessage ? (
            <p className="status-banner" role="status" aria-live="polite">
              {statusMessage}
            </p>
          ) : null}
        </div>
      </header>
      <nav className="app-nav" aria-label="Wallet sections">
        <div className="container">
          <ul>
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <main id="main-content" className="app-main">
        <div className="container">
          <section className="section-card" aria-labelledby="auth-section-title" id="auth-section">
            <header>
              <h2 id="auth-section-title">Register / Log in</h2>
              <p>Create sandbox credentials or sign back in to continue testing.</p>
            </header>
            {isAuthenticated ? (
              <EmptyState
                title="Session active"
                description="You are signed in. Load an account below to view balances and recent activity."
              />
            ) : (
              <div className="form-grid two-column">
                <form onSubmit={handleRegister} className="form-grid">
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
                <form onSubmit={handleLogin} className="form-grid">
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
            )}
          </section>

          <section className="section-card" aria-labelledby="account-section-title" id="account-section">
            <header>
              <h2 id="account-section-title">Account tools</h2>
              <p>Select an account to fetch balances and transactions.</p>
            </header>
            {isAuthenticated ? (
              <form onSubmit={handleAccountSelection} className="form-grid two-column">
                <label>
                  Account ID
                  <input
                    value={accountIdInput}
                    onChange={(event) => setAccountIdInput(event.target.value)}
                    placeholder="acct_..."
                  />
                </label>
                <button type="submit" disabled={accountStatus === 'pending'}>
                  {accountStatus === 'pending' ? 'Loading...' : 'Load account'}
                </button>
              </form>
            ) : (
              <EmptyState
                title="Sign in required"
                description="Register or log in to choose an account."
              />
            )}
          </section>

          <section className="section-card" aria-labelledby="balance-section-title" id="balance-section">
            <header>
              <h2 id="balance-section-title">Balance</h2>
              <p>Review available and total balances for the selected account.</p>
            </header>
            {!isAuthenticated ? (
              <EmptyState
                title="Sign in to view balances"
                description="Authenticate above to see account balances."
              />
            ) : !accountId ? (
              <EmptyState
                title="No account loaded"
                description={'Enter an account ID and select "Load account" to fetch balance details.'}
              />
            ) : accountStatus === 'pending' ? (
              <LoadingIndicator label="Loading account data..." />
            ) : !accountLoaded ? (
              <EmptyState
                title="Account unavailable"
                description="Unable to load account details. Verify the account ID and try again."
              />
            ) : balance ? (
              <div className="account-summary">
                <h3>Current balance</h3>
                <dl>
                  <div className="details-pair">
                    <dt>Available</dt>
                    <dd>{formatAmount(balance.available)}</dd>
                  </div>
                  <div className="details-pair">
                    <dt>Total</dt>
                    <dd>{formatAmount(balance.total)}</dd>
                  </div>
                  <div className="details-pair">
                    <dt>Updated</dt>
                    <dd>{formatTimestamp(balance.updatedAt)}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <EmptyState
                title="No balance data"
                description="The API did not return balance details for this account."
              />
            )}
          </section>

          <section className="section-card" aria-labelledby="transactions-section-title" id="transactions-section">
            <header>
              <h2 id="transactions-section-title">Transactions</h2>
              <p>Most recent account activity is listed here.</p>
            </header>
            {!isAuthenticated ? (
              <EmptyState
                title="Sign in to view transactions"
                description="Authenticate above to explore recent account activity."
              />
            ) : !accountId ? (
              <EmptyState
                title="Load an account"
                description="Choose an account ID to retrieve transactions."
              />
            ) : accountStatus === 'pending' ? (
              <LoadingIndicator label="Loading transactions..." />
            ) : !accountLoaded ? (
              <EmptyState
                title="Account unavailable"
                description="We could not fetch transactions for this account."
              />
            ) : transactions.length === 0 ? (
              <EmptyState
                title="No transactions yet"
                description="When this wallet account starts moving funds, activity will appear here."
              />
            ) : (
              <ul className="transaction-list">
                {transactions.map((transaction) => (
                  <li key={transaction.id}>
                    <strong>{transaction.type}</strong>
                    <span>{formatAmount(transaction.amount)}</span>
                    <span>
                      {transaction.status} - {formatTimestamp(transaction.createdAt)}
                    </span>
                    {transaction.counterpartyAccountId ? (
                      <span>Counterparty: {transaction.counterpartyAccountId}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="section-card" aria-labelledby="transfer-section-title" id="transfer-section">
            <header>
              <h2 id="transfer-section-title">Send transfer</h2>
              <p>Submit a simple account-to-account transfer.</p>
            </header>
            {!isAuthenticated ? (
              <EmptyState
                title="Sign in to send transfers"
                description="Register or log in before initiating transfers."
              />
            ) : !accountLoaded ? (
              <EmptyState
                title="Load an account first"
                description="Select an account above to act as the transfer source."
              />
            ) : (
              <form onSubmit={handleSendTransfer} className="form-grid two-column">
                <label>
                  Destination account
                  <input
                    value={transferDestination}
                    onChange={(event) => setTransferDestination(event.target.value)}
                    required
                    disabled={!canUseAccountActions || transferStatus === 'pending'}
                  />
                </label>
                <label>
                  Currency
                  <input
                    value={transferCurrency}
                    onChange={(event) => setTransferCurrency(event.target.value)}
                    disabled={!canUseAccountActions || transferStatus === 'pending'}
                  />
                </label>
                <label>
                  Amount
                  <input
                    value={transferAmount}
                    onChange={(event) => setTransferAmount(event.target.value)}
                    required
                    disabled={!canUseAccountActions || transferStatus === 'pending'}
                  />
                </label>
                <label>
                  Memo
                  <input
                    value={transferMemo}
                    onChange={(event) => setTransferMemo(event.target.value)}
                    placeholder="Optional"
                    disabled={!canUseAccountActions || transferStatus === 'pending'}
                  />
                </label>
                <button type="submit" disabled={!canSubmitTransfer}>
                  {transferStatus === 'pending' ? 'Sending...' : 'Send'}
                </button>
              </form>
            )}
          </section>

          <section className="section-card" aria-labelledby="quote-section-title" id="quote-section">
            <header>
              <h2 id="quote-section-title">Preview quote</h2>
              <p>Simulate currency conversion scenarios for remittances.</p>
            </header>
            {!isAuthenticated ? (
              <EmptyState
                title="Sign in to preview quotes"
                description="Authenticate above and load an account to simulate remittances."
              />
            ) : !accountLoaded ? (
              <EmptyState
                title="Load an account first"
                description="Quotes reference the currently loaded account."
              />
            ) : (
              <>
                <form onSubmit={handlePreviewQuote} className="form-grid">
                  <label>
                    USD amount
                    <input
                      value={quoteAmount}
                      onChange={(event) => setQuoteAmount(event.target.value)}
                      required
                      disabled={!canUseAccountActions || quoteStatus === 'pending'}
                    />
                  </label>
                  <fieldset className="form-grid" disabled={scenarioToggleDisabled}>
                    <legend>Scenario</legend>
                    <div className="button-group" role="group" aria-label="Quote scenario">
                      {QUOTE_SCENARIOS.map((scenario) => (
                        <button
                          key={scenario}
                          type="button"
                          onClick={() => setQuoteScenario(scenario)}
                          disabled={scenarioToggleDisabled}
                          aria-pressed={quoteScenario === scenario}
                          className="button-chip"
                        >
                          {scenario}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <button type="submit" disabled={!canPreviewQuote}>
                    {quoteStatus === 'pending' ? 'Fetching...' : 'Preview quote'}
                  </button>
                </form>
                {quote && (
                  <div className="quote-details">
                    <h3>Quote details</h3>
                    <dl>
                      <div className="details-pair">
                        <dt>Scenario</dt>
                        <dd>{quoteScenarioResult ?? '\\u2014'}</dd>
                      </div>
                      <div className="details-pair">
                        <dt>Quote ID</dt>
                        <dd>{quote.quoteId}</dd>
                      </div>
                      <div className="details-pair">
                        <dt>Sell amount</dt>
                        <dd>{formatAmount(quote.sellAmount)}</dd>
                      </div>
                      <div className="details-pair">
                        <dt>Buy amount</dt>
                        <dd>{formatAmount(quote.buyAmount)}</dd>
                      </div>
                      <div className="details-pair">
                        <dt>Rate</dt>
                        <dd>{quote.rate}</dd>
                      </div>
                      <div className="details-pair">
                        <dt>Expires</dt>
                        <dd>{formatTimestamp(quote.expiresAt)}</dd>
                      </div>
                    </dl>
                  </div>
                )}
                {!quote && quoteStatus === 'idle' && (
                  <EmptyState
                    title="No quote requested yet"
                    description="Enter an amount and choose a scenario to preview a quote."
                  />
                )}
              </>
            )}
          </section>

          <section className="section-card" aria-labelledby="offline-section-title" id="offline-section">
            <header>
              <h2 id="offline-section-title">Redeem offline voucher</h2>
              <p>Register and redeem signed offline vouchers.</p>
            </header>
            {!isAuthenticated ? (
              <EmptyState
                title="Sign in to redeem vouchers"
                description="Authenticate above to redeem signed offline vouchers."
              />
            ) : !accountLoaded ? (
              <EmptyState
                title="Load an account first"
                description="Offline vouchers credit the currently loaded account."
              />
            ) : (
              <>
                <form onSubmit={handleRedeemOfflineVoucher} className="form-grid">
                  <label>
                    Voucher payload
                    <textarea
                      value={offlineVoucherInput}
                      onChange={(event) => setOfflineVoucherInput(event.target.value)}
                      rows={6}
                      placeholder='{"id":"ovch_123","fromCardId":"card_001","toAccountId":"acc_123","amount":{"currency":"QZD","value":"10.00"},"nonce":"...","signature":"...","expiresAt":"2024-06-01T00:00:00Z"}'
                      disabled={offlineVoucherStatus === 'pending'}
                      required
                    />
                  </label>
                  <button type="submit" disabled={!canRedeemOfflineVoucher}>
                    {offlineVoucherStatus === 'pending' ? 'Redeeming...' : 'Redeem offline voucher'}
                  </button>
                </form>
                {redeemedOfflineVoucher ? (
                  <div className="offline-voucher-result">
                    <h3>Redeemed voucher</h3>
                    <dl>
                      <div className="details-pair">
                        <dt>Voucher ID</dt>
                        <dd>{redeemedOfflineVoucher.id}</dd>
                      </div>
                      <div className="details-pair">
                        <dt>Card</dt>
                        <dd>{redeemedOfflineVoucher.fromCardId}</dd>
                      </div>
                      <div className="details-pair">
                        <dt>Amount</dt>
                        <dd>{formatAmount(redeemedOfflineVoucher.amount)}</dd>
                      </div>
                      <div className="details-pair">
                        <dt>Status</dt>
                        <dd>{redeemedOfflineVoucher.status}</dd>
                      </div>
                      <div className="details-pair">
                        <dt>Expires</dt>
                        <dd>{formatTimestamp(redeemedOfflineVoucher.expiresAt)}</dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  offlineVoucherStatus === 'idle' && (
                    <EmptyState
                      title="No voucher redeemed yet"
                      description="Paste a signed voucher payload to test the offline redemption flow."
                    />
                  )
                )}
              </>
            )}
          </section>
        </div>
      </main>
      <footer className="footer">
        <div className="container">Sandbox tooling for QA, demos, and integration testing.</div>
      </footer>
    </div>
  );
}
