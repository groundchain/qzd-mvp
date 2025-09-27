import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AdminApi,
  AgentsApi,
  Configuration,
  type IssuanceRequest,
  type MonetaryAmount,
  type Voucher,
} from '@qzd/sdk-browser';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const KNOWN_VALIDATORS = ['validator-1', 'validator-2', 'validator-3'] as const;

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
    return '—';
  }
  return `${amount.value} ${amount.currency}`;
}

function formatProgress(request: IssuanceRequest): string {
  return `${request.status} (${request.collected}/${request.required})`;
}

function formatTimestamp(timestamp: Voucher['createdAt'] | Voucher['redeemedAt']): string {
  if (!timestamp) {
    return '—';
  }
  return timestamp instanceof Date ? timestamp.toISOString() : timestamp;
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
        const voucher = await agentsApi.redeemVoucher({ code });
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

  return (
    <main>
      <h1>Issuance Queue</h1>

      <section>
        <h2>Connection</h2>
        <form onSubmit={handleConnectionSubmit}>
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

      <section>
        <h2>Voucher redemption</h2>
        <form onSubmit={handleRedeemVoucher}>
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
            {redeemStatus === 'pending' ? 'Redeeming…' : 'Redeem voucher'}
          </button>
        </form>
        {redeemedVoucher ? (
          <article>
            <header>
              <h3>{redeemedVoucher.code}</h3>
            </header>
            <dl>
              <div>
                <dt>Amount</dt>
                <dd>{formatAmount(redeemedVoucher.amount)}</dd>
              </div>
              <div>
                <dt>Fee</dt>
                <dd>{formatAmount(redeemedVoucher.fee)}</dd>
              </div>
              <div>
                <dt>Total debited</dt>
                <dd>{formatAmount(redeemedVoucher.totalDebited)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{redeemedVoucher.status}</dd>
              </div>
              <div>
                <dt>Created at</dt>
                <dd>{formatTimestamp(redeemedVoucher.createdAt)}</dd>
              </div>
              {redeemedVoucher.redeemedAt ? (
                <div>
                  <dt>Redeemed at</dt>
                  <dd>{formatTimestamp(redeemedVoucher.redeemedAt)}</dd>
                </div>
              ) : null}
              {redeemedVoucher.metadata ? (
                <div>
                  <dt>Metadata</dt>
                  <dd>
                    <ul>
                      {Object.entries(redeemedVoucher.metadata).map(([key, value]) => (
                        <li key={key}>
                          <strong>{key}:</strong> {value}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
            </dl>
          </article>
        ) : (
          <p>No voucher redeemed yet.</p>
        )}
      </section>

      <section>
        <h2>Create issuance request</h2>
        <form onSubmit={handleCreateRequest}>
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
            {createStatus === 'pending' ? 'Submitting…' : 'Submit issuance request'}
          </button>
        </form>
      </section>

      <section>
        <h2>Validator actions</h2>
        <div>
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
            {loading === 'pending' ? 'Loading…' : 'Refresh queue'}
          </button>
        </div>
        {statusMessage ? <p>{statusMessage}</p> : null}
        {requests.length === 0 ? (
          <p>No issuance requests available.</p>
        ) : (
          <ul>
            {requests.map((request) => {
              const isSigning = signingId === request.id;
              const signingDisabled = isSigning || request.status === 'completed';
              return (
                <li key={request.id}>
                  <article>
                    <header>
                      <h3>{request.id}</h3>
                    </header>
                    <dl>
                      <div>
                        <dt>Account</dt>
                        <dd>{request.accountId}</dd>
                      </div>
                      <div>
                        <dt>Amount</dt>
                        <dd>{formatAmount(request.amount)}</dd>
                      </div>
                      <div>
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
                      {isSigning ? 'Signing…' : `Sign as ${selectedValidator}`}
                    </button>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
