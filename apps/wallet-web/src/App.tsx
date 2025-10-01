import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
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
import { createIdempotencyKey, createSignedFetch } from '@qzd/shared/request-security';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const QUOTE_SCENARIOS = ['DEFAULT', 'TARIFFED', 'SUBSIDIZED'] as const;

type QuoteScenario = (typeof QUOTE_SCENARIOS)[number];

type AsyncStatus = 'idle' | 'pending';

const SIGNING_PRIVATE_KEY = import.meta.env.VITE_SIGNING_PRIVATE_KEY as string | undefined;
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

      {!token && (
        <section aria-labelledby="auth-section">
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
        <section aria-labelledby="account-section">
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
        <section aria-labelledby="balance-section">
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
        <section aria-labelledby="transactions-section">
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
        <section aria-labelledby="transfer-section">
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
        <section aria-labelledby="quote-section">
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
              <fieldset disabled={scenarioToggleDisabled}>
                <legend>Scenario</legend>
                <div role="group" aria-label="Quote scenario">
                  {QUOTE_SCENARIOS.map((scenario) => (
                    <button
                      key={scenario}
                      type="button"
                      onClick={() => setQuoteScenario(scenario)}
                      disabled={scenarioToggleDisabled}
                      aria-pressed={quoteScenario === scenario}
                      style={{ fontWeight: quoteScenario === scenario ? 600 : 400, marginRight: '0.5rem' }}
                    >
                      {scenario}
                    </button>
                  ))}
                </div>
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
                  <dt>Scenario</dt>
                  <dd>{quoteScenarioResult ?? '—'}</dd>
                </div>
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

      {token && (
        <section aria-labelledby="offline-section">
          <h2 id="offline-section">Redeem offline voucher</h2>
          {!accountLoaded && <p>Load an account to redeem offline vouchers.</p>}
          {accountLoaded && (
            <form onSubmit={handleRedeemOfflineVoucher} className="offline-form">
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
                {offlineVoucherStatus === 'pending' ? 'Redeeming…' : 'Redeem offline voucher'}
              </button>
            </form>
          )}

          {accountLoaded && redeemedOfflineVoucher && (
            <div className="offline-voucher-result">
              <h3>Redeemed voucher</h3>
              <dl>
                <div>
                  <dt>Voucher ID</dt>
                  <dd>{redeemedOfflineVoucher.id}</dd>
                </div>
                <div>
                  <dt>Card</dt>
                  <dd>{redeemedOfflineVoucher.fromCardId}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{formatAmount(redeemedOfflineVoucher.amount)}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{redeemedOfflineVoucher.status}</dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>{formatTimestamp(redeemedOfflineVoucher.expiresAt)}</dd>
                </div>
              </dl>
            </div>
          )}

          {accountLoaded && !redeemedOfflineVoucher && offlineVoucherStatus === 'idle' && (
            <p>No offline voucher redeemed yet.</p>
          )}
        </section>
      )}
    </main>
  );
}
