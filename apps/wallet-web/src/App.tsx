import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
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
import './App.css';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const QUOTE_SCENARIOS = ['DEFAULT', 'SUBSIDIZED', 'TARIFFED'] as const;
const NAV_SECTIONS = ['auth', 'account', 'balance', 'transactions', 'transfer', 'quote'] as const;

type QuoteScenario = (typeof QUOTE_SCENARIOS)[number];
type NavigationSection = (typeof NAV_SECTIONS)[number];

type NavItem = {
  id: NavigationSection;
  label: string;
  disabled?: boolean;
  badge?: string;
};

type AsyncStatus = 'idle' | 'pending';

const NAV_SECTION_SET = new Set<NavigationSection>(NAV_SECTIONS);

function useHashNavigation(defaultSection: NavigationSection): [NavigationSection, (next: NavigationSection) => void] {
  const readSection = useCallback((): NavigationSection => {
    if (typeof window === 'undefined') {
      return defaultSection;
    }
    const raw = window.location.hash.replace(/^#/, '') as NavigationSection;
    if (NAV_SECTION_SET.has(raw)) {
      return raw;
    }
    return defaultSection;
  }, [defaultSection]);

  const [active, setActive] = useState<NavigationSection>(() => readSection());

  useEffect(() => {
    setActive(readSection());
  }, [readSection]);

  useEffect(() => {
    const handleHashChange = () => {
      setActive(readSection());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [readSection]);

  const navigate = useCallback((next: NavigationSection) => {
    if (typeof window !== 'undefined') {
      const nextHash = `#${next}`;
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
      } else {
        setActive(next);
      }
    } else {
      setActive(next);
    }
  }, []);

  return [active, navigate];
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `idem-${crypto.randomUUID()}`;
  }
  const randomSuffix = Math.random().toString(16).slice(2);
  return `idem-${Date.now()}-${randomSuffix}`;
}

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
  const [accountLoaded, setAccountLoaded] = useState(false);
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
        resetStatus(null);
      } catch (error) {
        console.error('Quote request failed', error);
        resetStatus(error instanceof Error ? error.message : 'Unable to fetch quote.');
        setQuote(null);
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

  const defaultSection = useMemo<NavigationSection>(() => {
    if (!token) {
      return 'auth';
    }
    if (!accountLoaded) {
      return 'account';
    }
    return 'balance';
  }, [accountLoaded, token]);

  const [activeSection, setActiveSection] = useHashNavigation(defaultSection);
  const transactionsCount = transactions.length;

  const navItems = useMemo<NavItem[]>(() => {
    if (!token) {
      return [{ id: 'auth', label: 'Authenticate' }];
    }

    const items: NavItem[] = [
      { id: 'account', label: 'Load account' },
      { id: 'balance', label: 'Balance', disabled: !accountId },
      {
        id: 'transactions',
        label: 'Transactions',
        disabled: !accountId,
        badge: accountLoaded && transactionsCount > 0 ? String(transactionsCount) : undefined,
      },
      { id: 'transfer', label: 'Send transfer', disabled: !canUseAccountActions },
      { id: 'quote', label: 'Preview quote', disabled: !canUseAccountActions },
    ];

    return items;
  }, [accountId, accountLoaded, canUseAccountActions, token, transactionsCount]);

  useEffect(() => {
    if (navItems.length === 0) {
      return;
    }
    if (!navItems.some((item) => item.id === activeSection)) {
      setActiveSection(navItems[0].id);
    }
  }, [activeSection, navItems, setActiveSection]);

  const currentSectionLabel = useMemo(() => {
    return navItems.find((item) => item.id === activeSection)?.label ?? navItems[0]?.label ?? 'Wallet';
  }, [activeSection, navItems]);

  return (
    <div className="app-shell">
      <AppHeader
        baseUrl={configuredBaseUrl}
        sessionActive={Boolean(token)}
        statusMessage={statusMessage}
        currentSectionLabel={currentSectionLabel}
      />

      <div className="app-frame">
        <SideNav items={navItems} activeSection={activeSection} onNavigate={setActiveSection} />

        <main className="app-content">
          {!token && (
            <section id="auth" aria-labelledby="auth-section">
              <h2 id="auth-section">Register / Log in</h2>
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
          )}

          {token && (
            <section id="account" aria-labelledby="account-section">
              <h2 id="account-section">Load account</h2>
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
            </section>
          )}

          {token && (
            <section id="balance" aria-labelledby="balance-section">
              <h2 id="balance-section">Balance</h2>
              {!accountId && <p>Enter an account ID and load it to view balances.</p>}
              {accountId && accountStatus === 'pending' && <p aria-live="polite">Loading account data…</p>}
              {accountId && accountStatus === 'idle' && !accountLoaded && (
                <p>Unable to load account details. Verify the account ID.</p>
              )}
              {accountLoaded && balance && (
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
            </section>
          )}

          {token && (
            <section id="transactions" aria-labelledby="transactions-section">
              <h2 id="transactions-section">Transactions</h2>
              {!accountLoaded && <p>Load an account to view recent transactions.</p>}
              {accountLoaded && transactions.length === 0 ? (
                <p>No transactions to display.</p>
              ) : null}
              {accountLoaded && transactions.length > 0 && (
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
            </section>
          )}

          {token && (
            <section id="transfer" aria-labelledby="transfer-section">
              <h2 id="transfer-section">Send transfer</h2>
              {!accountLoaded && <p>Load an account to send funds.</p>}
              {accountLoaded && (
                <form onSubmit={handleSendTransfer} className="transfer-form">
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
                    {transferStatus === 'pending' ? 'Sending…' : 'Send'}
                  </button>
                </form>
              )}
            </section>
          )}

          {token && (
            <section id="quote" aria-labelledby="quote-section">
              <h2 id="quote-section">Preview quote</h2>
              {!accountLoaded && <p>Load an account to preview quotes.</p>}
              {accountLoaded && (
                <form onSubmit={handlePreviewQuote} className="quote-form">
                  <label>
                    USD amount
                    <input
                      value={quoteAmount}
                      onChange={(event) => setQuoteAmount(event.target.value)}
                      required
                      disabled={!canUseAccountActions || quoteStatus === 'pending'}
                    />
                  </label>
                  <fieldset disabled={!canUseAccountActions || quoteStatus === 'pending'}>
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
                  <button type="submit" disabled={!canPreviewQuote}>
                    {quoteStatus === 'pending' ? 'Fetching…' : 'Preview quote'}
                  </button>
                </form>
              )}

              {accountLoaded && quote && (
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
          )}
        </main>
      </div>
    </div>
  );
}

type AppHeaderProps = {
  baseUrl: string;
  sessionActive: boolean;
  statusMessage: string | null;
  currentSectionLabel: string;
};

function AppHeader({ baseUrl, sessionActive, statusMessage, currentSectionLabel }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__titles">
        <h1>QZD Wallet</h1>
        <p className="app-header__section" aria-live="polite">
          {currentSectionLabel}
        </p>
      </div>
      <dl className="app-header__meta">
        <div>
          <dt>API base</dt>
          <dd>
            <code>{baseUrl}</code>
          </dd>
        </div>
        <div>
          <dt>Session</dt>
          <dd>{sessionActive ? 'Active' : 'Not signed in'}</dd>
        </div>
      </dl>
      {statusMessage ? (
        <p className="app-header__status" role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}
    </header>
  );
}

type SideNavProps = {
  items: NavItem[];
  activeSection: NavigationSection;
  onNavigate: (next: NavigationSection) => void;
};

function SideNav({ items, activeSection, onNavigate }: SideNavProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav className="side-nav" aria-label="Wallet navigation">
      <ul>
        {items.map((item) => {
          const isActive = item.id === activeSection;
          const disabled = item.disabled ?? false;
          const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
            if (disabled) {
              event.preventDefault();
              return;
            }
            onNavigate(item.id);
          };

          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={handleClick}
                className={`side-nav__link${isActive ? ' side-nav__link--active' : ''}${disabled ? ' side-nav__link--disabled' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                aria-disabled={disabled}
              >
                <span>{item.label}</span>
                {item.badge ? <span className="side-nav__badge">{item.badge}</span> : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
