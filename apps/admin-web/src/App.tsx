import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  AdminApi,
  AgentsApi,
  Configuration,
  type IssuanceRequest,
  type MonetaryAmount,
  type Voucher,
} from '@qzd/sdk-browser';
import {
  DEFAULT_DEV_SIGNING_PRIVATE_KEY_HEX,
  createIdempotencyKey,
  createSignedFetch,
} from '@qzd/shared/request-security';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const KNOWN_VALIDATORS = ['validator-1', 'validator-2', 'validator-3'] as const;
const SIGNING_PRIVATE_KEY =
  (import.meta.env.VITE_SIGNING_PRIVATE_KEY as string | undefined)?.trim() ??
  (import.meta.env.DEV ? DEFAULT_DEV_SIGNING_PRIVATE_KEY_HEX : undefined);
const SIGNED_FETCH = createSignedFetch(SIGNING_PRIVATE_KEY);

type AsyncStatus = 'idle' | 'pending';

type ValidatorId = (typeof KNOWN_VALIDATORS)[number];

function sanitizeBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_API_BASE_URL;
  }
  return trimmed.replace(/\/+$/, '');
}

function formatAmount(amount: MonetaryAmount | undefined | null): string {
  if (!amount?.value || !amount?.currency) {
    return '\\u2014';
  }
  return `${amount.value} ${amount.currency}`;
}

function formatProgress(request: IssuanceRequest): string {
  return `${request.status} (${request.collected}/${request.required})`;
}

function formatTimestamp(timestamp: Voucher['createdAt'] | Voucher['redeemedAt']): string {
  if (!timestamp) {
    return '\\u2014';
  }
  return timestamp instanceof Date ? timestamp.toISOString() : timestamp;
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
  const [baseUrlInput, setBaseUrlInput] = useState(configuredBaseUrl);
  const [baseUrl, setBaseUrl] = useState(configuredBaseUrl);
  const [tokenInput, setTokenInput] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [selectedValidator, setSelectedValidator] = useState<ValidatorId>(KNOWN_VALIDATORS[0]);
  const [requests, setRequests] = useState<IssuanceRequest[]>([]);
  const [loading, setLoading] = useState<AsyncStatus>('idle');
  const [signingId, setSigningId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [accountIdInput, setAccountIdInput] = useState('');
  const [amountInput, setAmountInput] = useState('100.00');
  const [currencyInput, setCurrencyInput] = useState('QZD');
  const [referenceInput, setReferenceInput] = useState('');
  const [createStatus, setCreateStatus] = useState<AsyncStatus>('idle');
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [redeemStatus, setRedeemStatus] = useState<AsyncStatus>('idle');
  const [redeemedVoucher, setRedeemedVoucher] = useState<Voucher | null>(null);

  const configuration = useMemo(
    () =>
      new Configuration({
        basePath: baseUrl,
        accessToken: token ? async () => token : undefined,
        fetchApi: SIGNED_FETCH,
      }),
    [baseUrl, token],
  );

  const adminApi = useMemo(() => new AdminApi(configuration), [configuration]);
  const agentsApi = useMemo(() => new AgentsApi(configuration), [configuration]);

  const resetStatus = useCallback((message: string | null) => {
    setStatusMessage(message);
  }, []);

  const refreshRequests = useCallback(async () => {
    if (!token) {
      setRequests([]);
      return;
    }

    setLoading('pending');
    try {
      const response = await adminApi.listIssuanceRequests();
      setRequests(response.items ?? []);
      resetStatus(null);
    } catch (error) {
      console.error('Failed to load issuance requests', error);
      resetStatus(error instanceof Error ? error.message : 'Unable to load issuance requests.');
    } finally {
      setLoading('idle');
    }
  }, [adminApi, token, resetStatus]);

  useEffect(() => {
    if (token) {
      void refreshRequests();
    } else {
      setRequests([]);
    }
  }, [token, refreshRequests]);

  const handleConnectionSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setBaseUrl(sanitizeBaseUrl(baseUrlInput));
      setToken(tokenInput.trim() || null);
    },
    [baseUrlInput, tokenInput],
  );

  const handleRefresh = useCallback(() => {
    if (!token) {
      resetStatus('Provide an access token before refreshing the queue.');
      return;
    }
    void refreshRequests();
  }, [refreshRequests, resetStatus, token]);

  const handleSign = useCallback(
    async (requestId: string) => {
      if (!token) {
        resetStatus('Provide an access token before signing requests.');
        return;
      }

      setSigningId(requestId);
      try {
        await adminApi.signIssuanceRequest({
          id: requestId,
          idempotencyKey: createIdempotencyKey(),
          signIssuanceRequestRequest: { validatorId: selectedValidator },
        });
        resetStatus(`Signature recorded for ${requestId} as ${selectedValidator}.`);
        await refreshRequests();
      } catch (error) {
        console.error('Failed to sign issuance request', error);
        resetStatus(error instanceof Error ? error.message : 'Unable to record signature.');
      } finally {
        setSigningId(null);
      }
    },
    [adminApi, refreshRequests, resetStatus, selectedValidator, token],
  );

  const handleCreateRequest = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!token) {
        resetStatus('Provide an access token before creating issuance requests.');
        return;
      }

      const accountId = accountIdInput.trim();
      const amountValue = amountInput.trim();
      const currencyValue = currencyInput.trim() || 'QZD';
      const reference = referenceInput.trim();

      if (!accountId || !amountValue) {
        resetStatus('Account ID and amount are required to create an issuance request.');
        return;
      }

      setCreateStatus('pending');
      try {
        await adminApi.createIssuanceRequest({
          idempotencyKey: createIdempotencyKey(),
          issueRequest: {
            accountId,
            amount: { currency: currencyValue, value: amountValue },
            reference: reference || undefined,
          },
        });
        setAccountIdInput('');
        setAmountInput('100.00');
        setReferenceInput('');
        resetStatus('Issuance request submitted to the queue.');
        await refreshRequests();
      } catch (error) {
        console.error('Failed to create issuance request', error);
        resetStatus(error instanceof Error ? error.message : 'Unable to create issuance request.');
      } finally {
        setCreateStatus('idle');
      }
    },
    [accountIdInput, adminApi, amountInput, currencyInput, referenceInput, refreshRequests, resetStatus, token],
  );

  const handleRedeemVoucher = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!token) {
        resetStatus('Provide an access token before redeeming vouchers.');
        return;
      }

      const code = voucherCodeInput.trim();
      if (!code) {
        resetStatus('Enter a voucher code to redeem.');
        return;
      }

      setRedeemStatus('pending');
      setRedeemedVoucher(null);
      try {
        const voucher = await agentsApi.redeemVoucher({
          code,
          idempotencyKey: createIdempotencyKey(),
        });
        setRedeemedVoucher(voucher);
        setVoucherCodeInput('');
        resetStatus(`Voucher ${voucher.code} redeemed successfully.`);
      } catch (error) {
        console.error('Failed to redeem voucher', error);
        resetStatus(error instanceof Error ? error.message : 'Unable to redeem voucher.');
      } finally {
        setRedeemStatus('idle');
      }
    },
    [agentsApi, resetStatus, token, voucherCodeInput],
  );

  const isAuthenticated = Boolean(token);
  const navLinks = [
    { href: '#connection-section', label: 'Connection' },
    { href: '#redeem-section', label: 'Voucher redemption' },
    { href: '#issuance-section', label: 'Create request' },
    { href: '#validator-section', label: 'Validator actions' },
  ];

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="app-header">
        <div className="container">
          <div>
            <h1 className="app-title">Issuance Queue</h1>
            <p className="app-subtitle">
              Monitor issuance requests, redeem vouchers, and act as a validator across environments.
            </p>
          </div>
          <div className="session-meta">
            <span className="session-pill" data-status={isAuthenticated ? 'active' : 'inactive'}>
              {isAuthenticated ? 'Token saved' : 'Token required'}
            </span>
            <span>
              API base URL: <code className="code-inline">{baseUrl}</code>
            </span>
          </div>
          {statusMessage ? (
            <p className="status-banner" role="status" aria-live="polite">
              {statusMessage}
            </p>
          ) : null}
        </div>
      </header>
      <nav className="app-nav" aria-label="Admin sections">
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
          <section className="section-card" aria-labelledby="connection-title" id="connection-section">
            <header>
              <h2 id="connection-title">Connection</h2>
              <p>Point the console at your API environment and provide an admin access token.</p>
            </header>
            <form onSubmit={handleConnectionSubmit} className="form-grid">
              <label>
                API base URL
                <input
                  type="text"
                  value={baseUrlInput}
                  onChange={(event) => setBaseUrlInput(event.target.value)}
                  placeholder={DEFAULT_API_BASE_URL}
                />
              </label>
              <label>
                Access token
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  placeholder="Paste bearer token"
                />
              </label>
              <button type="submit">Save connection</button>
            </form>
          </section>

          <section className="section-card" aria-labelledby="redeem-title" id="redeem-section">
            <header>
              <h2 id="redeem-title">Voucher redemption</h2>
              <p>Test voucher codes issued to agents and confirm settlement details.</p>
            </header>
            {!isAuthenticated ? (
              <EmptyState
                title="Add an access token"
                description="Provide a valid admin token above to redeem vouchers."
              />
            ) : (
              <>
                <form onSubmit={handleRedeemVoucher} className="form-grid two-column">
                  <label>
                    Voucher code
                    <input
                      type="text"
                      value={voucherCodeInput}
                      onChange={(event) => setVoucherCodeInput(event.target.value)}
                      placeholder="vch_000001"
                    />
                  </label>
                  <button type="submit" disabled={redeemStatus === 'pending'}>
                    {redeemStatus === 'pending' ? 'Redeeming...' : 'Redeem voucher'}
                  </button>
                </form>
                {redeemedVoucher ? (
                  <div className="card-item">
                    <header>
                      <h3>{redeemedVoucher.code}</h3>
                      <span
                        className="badge"
                        data-variant={redeemedVoucher.status === 'redeemed' ? 'completed' : 'pending'}
                      >
                        {redeemedVoucher.status}
                      </span>
                    </header>
                    <dl className="meta-grid">
                      <div className="details-pair">
                        <dt>Amount</dt>
                        <dd>{formatAmount(redeemedVoucher.amount)}</dd>
                      </div>
                      <div className="details-pair">
                        <dt>Fee</dt>
                        <dd>{formatAmount(redeemedVoucher.fee)}</dd>
                      </div>
                      <div className="details-pair">
                        <dt>Total debited</dt>
                        <dd>{formatAmount(redeemedVoucher.totalDebited)}</dd>
                      </div>
                      <div className="details-pair">
                        <dt>Created at</dt>
                        <dd>{formatTimestamp(redeemedVoucher.createdAt)}</dd>
                      </div>
                      <div className="details-pair">
                        <dt>Redeemed at</dt>
                        <dd>{formatTimestamp(redeemedVoucher.redeemedAt)}</dd>
                      </div>
                    </dl>
                    {redeemedVoucher.metadata ? (
                      <div>
                        <h4>Metadata</h4>
                        <ul>
                          {Object.entries(redeemedVoucher.metadata).map(([key, value]) => (
                            <li key={key}>
                              <strong>{key}:</strong> {value}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  redeemStatus === 'idle' && (
                    <EmptyState
                      title="No voucher redeemed yet"
                      description="Redeem a voucher code to review settlement details."
                    />
                  )
                )}
              </>
            )}
          </section>

          <section className="section-card" aria-labelledby="issuance-title" id="issuance-section">
            <header>
              <h2 id="issuance-title">Create issuance request</h2>
              <p>Queue a new issuance for validators to approve.</p>
            </header>
            {!isAuthenticated ? (
              <EmptyState
                title="Add an access token"
                description="Authenticate above before creating issuance requests."
              />
            ) : (
              <form onSubmit={handleCreateRequest} className="form-grid two-column">
                <label>
                  Account ID
                  <input
                    type="text"
                    value={accountIdInput}
                    onChange={(event) => setAccountIdInput(event.target.value)}
                    placeholder="acct_000001"
                  />
                </label>
                <label>
                  Amount
                  <input
                    type="text"
                    value={amountInput}
                    onChange={(event) => setAmountInput(event.target.value)}
                    placeholder="100.00"
                  />
                </label>
                <label>
                  Currency
                  <input
                    type="text"
                    value={currencyInput}
                    onChange={(event) => setCurrencyInput(event.target.value)}
                    placeholder="QZD"
                  />
                </label>
                <label>
                  Reference (optional)
                  <input
                    type="text"
                    value={referenceInput}
                    onChange={(event) => setReferenceInput(event.target.value)}
                  />
                </label>
                <button type="submit" disabled={createStatus === 'pending'}>
                  {createStatus === 'pending' ? 'Submitting...' : 'Submit issuance request'}
                </button>
              </form>
            )}
          </section>

          <section className="section-card" aria-labelledby="validator-title" id="validator-section">
            <header>
              <h2 id="validator-title">Validator actions</h2>
              <p>Act as a validator to advance issuance requests to completion.</p>
            </header>
            {!isAuthenticated ? (
              <EmptyState
                title="Add an access token"
                description="Authenticate above to view and sign issuance requests."
              />
            ) : (
              <div className="meta-grid">
                <div className="form-grid two-column">
                  <label>
                    Validator identity
                    <select
                      value={selectedValidator}
                      onChange={(event) => setSelectedValidator(event.target.value as ValidatorId)}
                    >
                      {KNOWN_VALIDATORS.map((validator) => (
                        <option key={validator} value={validator}>
                          {validator}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={handleRefresh} disabled={loading === 'pending'}>
                    {loading === 'pending' ? 'Loading...' : 'Refresh queue'}
                  </button>
                </div>
                {loading === 'pending' ? <LoadingIndicator label="Refreshing requests..." /> : null}
                {requests.length === 0 ? (
                  <EmptyState
                    title="No issuance requests"
                    description="Requests awaiting validator action will appear here."
                  />
                ) : (
                  <ul className="card-list">
                    {requests.map((request) => {
                      const isSigning = signingId === request.id;
                      const signingDisabled = isSigning || request.status === 'completed';
                      const badgeVariant = request.status === 'completed' ? 'completed' : 'pending';
                      return (
                        <li key={request.id} className="card-item">
                          <header>
                            <h3>{request.id}</h3>
                            <span className="badge" data-variant={badgeVariant}>
                              {request.status}
                            </span>
                          </header>
                          <dl className="meta-grid">
                            <div className="details-pair">
                              <dt>Account</dt>
                              <dd>{request.accountId}</dd>
                            </div>
                            <div className="details-pair">
                              <dt>Amount</dt>
                              <dd>{formatAmount(request.amount)}</dd>
                            </div>
                            <div className="details-pair">
                              <dt>Progress</dt>
                              <dd>{formatProgress(request)}</dd>
                            </div>
                          </dl>
                          <button
                            type="button"
                            onClick={() => {
                              void handleSign(request.id);
                            }}
                            disabled={signingDisabled}
                          >
                            {isSigning ? 'Signing...' : `Sign as ${selectedValidator}`}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
      <footer className="footer">
        <div className="container">Admin console for operational testing and support workflows.</div>
      </footer>
    </div>
  );
}
