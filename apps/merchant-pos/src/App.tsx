import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  AuthApi,
  Configuration,
  TransactionsApi,
  type Transaction,
} from '@qzd/sdk-browser';
import {
  buildPaymentMatch,
  createInvoice,
  encodeInvoicePayload,
  transactionMatchesInvoice,
  type Invoice,
} from './lib/invoices';
import {
  DEFAULT_DEV_SIGNING_PRIVATE_KEY_HEX,
  createIdempotencyKey,
  createSignedFetch,
} from '@qzd/shared/request-security';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const POLL_INTERVAL_MS = 5000;
const SIGNING_PRIVATE_KEY =
  (import.meta.env.VITE_SIGNING_PRIVATE_KEY as string | undefined)?.trim() ??
  (import.meta.env.DEV ? DEFAULT_DEV_SIGNING_PRIVATE_KEY_HEX : undefined);
const SIGNED_FETCH = createSignedFetch(SIGNING_PRIVATE_KEY);

type AsyncStatus = 'idle' | 'pending';

type InvoiceFormState = {
  amountValue: string;
  currency: string;
  description: string;
  customerName: string;
};

function sanitizeBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_API_BASE_URL;
  }
  return trimmed.replace(/\/+$/, '');
}

function formatAmount(invoice: Invoice): string {
  return `${invoice.amount.value} ${invoice.amount.currency}`;
}

function formatTimestamp(value: string | Date | undefined): string {
  if (!value) {
    return '—';
  }

  const asDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    return String(value);
  }

  return asDate.toLocaleString();
}

export default function App(): JSX.Element {
  const configuredBaseUrl = sanitizeBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined);
  const [token, setToken] = useState<string | null>(null);
  const [accountIdInput, setAccountIdInput] = useState('');
  const [accountId, setAccountId] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AsyncStatus>('idle');
  const [invoiceStatus, setInvoiceStatus] = useState<AsyncStatus>('idle');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [authenticatedEmail, setAuthenticatedEmail] = useState<string | null>(null);
  const [form, setForm] = useState<InvoiceFormState>({
    amountValue: '25.00',
    currency: 'QZD',
    description: '',
    customerName: '',
  });

  const invoicesRef = useRef<Invoice[]>([]);

  useEffect(() => {
    invoicesRef.current = invoices;
  }, [invoices]);

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
  const transactionsApi = useMemo(() => new TransactionsApi(configuration), [configuration]);

  const resetStatus = useCallback((message: string | null) => {
    setStatusMessage(message);
  }, []);

  const handleRegister = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (authStatus === 'pending') {
        return;
      }

      const formData = new FormData(event.currentTarget);
      const fullName = String(formData.get('register-name') ?? '').trim();
      const email = String(formData.get('register-email') ?? '').trim();
      const password = String(formData.get('register-password') ?? '').trim();

      if (!fullName || !email || !password) {
        resetStatus('Name, email, and password are required to register.');
        return;
      }

      setAuthStatus('pending');
      try {
        const response = await authApi.registerUser({
          idempotencyKey: createIdempotencyKey(),
          registerUserRequest: { email, password, fullName },
        });

        const sessionToken = response.token ?? null;
        const newAccountId = response.account?.id ?? '';

        setToken(sessionToken);
        setAuthenticatedEmail(email);
        setAccountIdInput(newAccountId);
        setAccountId(newAccountId);
        resetStatus(
          sessionToken
            ? 'Registration successful. You are now signed in.'
            : 'Registration successful. Please log in.',
        );
      } catch (error) {
        console.error('Registration failed', error);
        resetStatus(error instanceof Error ? error.message : 'Registration failed.');
      } finally {
        setAuthStatus('idle');
      }
    },
    [authApi, authStatus, resetStatus],
  );

  const handleLogin = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (authStatus === 'pending') {
        return;
      }

      const formData = new FormData(event.currentTarget);
      const email = String(formData.get('login-email') ?? '').trim();
      const password = String(formData.get('login-password') ?? '').trim();

      if (!email || !password) {
        resetStatus('Email and password are required to sign in.');
        return;
      }

      setAuthStatus('pending');
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
        setAuthenticatedEmail(email);
        setAccountId('');
        setAccountIdInput('');
        setInvoices([]);
        resetStatus('Logged in successfully.');
      } catch (error) {
        console.error('Login failed', error);
        resetStatus(error instanceof Error ? error.message : 'Login failed.');
      } finally {
        setAuthStatus('idle');
      }
    },
    [authApi, authStatus, resetStatus],
  );

  const handleAccountSelection = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!token) {
        resetStatus('Sign in before monitoring an account.');
        return;
      }
      const nextId = accountIdInput.trim();
      setAccountId(nextId);
      if (nextId) {
        setInvoices((current) => current.filter((invoice) => invoice.accountId === nextId));
      } else {
        setInvoices([]);
      }
      if (!nextId) {
        resetStatus('Enter an account ID to monitor invoices.');
        return;
      }
      resetStatus(`Monitoring account ${nextId}. Waiting for payments…`);
    },
    [accountIdInput, resetStatus, token],
  );

  const handleInvoiceFieldChange = useCallback(<Field extends keyof InvoiceFormState>(field: Field, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleCreateInvoice = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!token || !accountId) {
        resetStatus('Sign in and select an account before creating invoices.');
        return;
      }

      setInvoiceStatus('pending');
      try {
        const invoice = createInvoice({
          accountId,
          amountValue: form.amountValue,
          currency: form.currency,
          description: form.description,
          customerName: form.customerName,
        });

        const payload = encodeInvoicePayload(invoice);
        const qrCodeDataUrl = await QRCode.toDataURL(payload, { width: 256, margin: 1 });

        const invoiceWithQr: Invoice = { ...invoice, qrCodeDataUrl };

        setInvoices((current) => [invoiceWithQr, ...current]);
        resetStatus('Invoice generated. Share the QR code and memo with the customer.');
      } catch (error) {
        console.error('Failed to create invoice', error);
        resetStatus(error instanceof Error ? error.message : 'Unable to create invoice.');
      } finally {
        setInvoiceStatus('idle');
      }
    },
    [accountId, form, resetStatus, token],
  );

  const pollForPayments = useCallback(
    async (signal: AbortSignal) => {
      if (!token || !accountId) {
        return;
      }

      const pendingInvoices = invoicesRef.current.filter((invoice) => invoice.status === 'pending');
      if (pendingInvoices.length === 0) {
        return;
      }

      try {
        const response = await transactionsApi.listAccountTransactions({ id: accountId, limit: 50 });
        const transactions = response.items ?? [];

        const matches: Array<{ invoice: Invoice; transaction: Transaction }> = [];
        for (const invoice of pendingInvoices) {
          const match = transactions.find((transaction) => transactionMatchesInvoice(transaction, invoice));
          if (match) {
            matches.push({ invoice, transaction: match });
          }
        }

        if (matches.length === 0) {
          return;
        }

        setInvoices((current) =>
          current.map((invoice) => {
            const found = matches.find((item) => item.invoice.id === invoice.id);
            if (!found) {
              return invoice;
            }

            const payment = buildPaymentMatch(found.transaction, invoice);
            return {
              ...invoice,
              status: 'paid',
              paidTransactionId: payment.transactionId,
              paidAt: payment.paidAt,
            } satisfies Invoice;
          }),
        );
        resetStatus('Payment received. Invoice marked as paid.');
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        console.error('Failed to poll transactions', error);
      }
    },
    [accountId, resetStatus, token, transactionsApi],
  );

  useEffect(() => {
    if (!token || !accountId) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const tick = async () => {
      if (cancelled) {
        return;
      }
      await pollForPayments(controller.signal);
    };

    const interval = window.setInterval(() => {
      void tick();
    }, POLL_INTERVAL_MS);

    void tick();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [accountId, pollForPayments, token]);

  const handleCopyMemo = useCallback(
    async (memo: string) => {
      try {
        if (!('clipboard' in navigator) || typeof navigator.clipboard?.writeText !== 'function') {
          throw new Error('Clipboard API unavailable');
        }
        await navigator.clipboard.writeText(memo);
        resetStatus('Invoice memo copied to clipboard.');
      } catch (error) {
        console.error('Failed to copy memo', error);
        resetStatus('Unable to access the clipboard. Copy manually.');
      }
    },
    [resetStatus],
  );

  const handleExportReceipt = useCallback((invoice: Invoice) => {
    if (invoice.status !== 'paid') {
      return;
    }

    const doc = new jsPDF();
    const startY = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('QZD Payment Receipt', 14, startY);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice reference: ${invoice.reference}`, 14, startY + 12);
    doc.text(`Amount: ${formatAmount(invoice)}`, 14, startY + 20);
    doc.text(`Customer: ${invoice.customerName ?? '—'}`, 14, startY + 28);
    doc.text(`Description: ${invoice.description ?? '—'}`, 14, startY + 36);
    doc.text(`Paid at: ${formatTimestamp(invoice.paidAt)}`, 14, startY + 44);
    doc.text(`Transaction ID: ${invoice.paidTransactionId ?? '—'}`, 14, startY + 52);

    doc.setFont('helvetica', 'italic');
    doc.text('Generated by QZD Merchant POS', 14, startY + 64);

    doc.save(`qzd-receipt-${invoice.reference}.pdf`);
  }, []);

  const canManageInvoices = Boolean(token && accountId);
  const isAuthenticated = Boolean(token);

  const handleLogout = useCallback(() => {
    setToken(null);
    setAuthenticatedEmail(null);
    setAccountId('');
    setAccountIdInput('');
    setInvoices([]);
    resetStatus('Signed out.');
  }, [resetStatus]);

  return (
    <main>
      <header>
        <h1>QZD Merchant POS</h1>
        <p>Generate QR invoices, confirm wallet payments, and export receipts.</p>
      </header>

      {statusMessage && <p className="status-message">{statusMessage}</p>}

      <section aria-labelledby="auth-section">
        <h2 id="auth-section">Merchant access</h2>
        {isAuthenticated ? (
          <div className="auth-summary">
            <p>
              Signed in{authenticatedEmail ? ` as ${authenticatedEmail}` : ''}. Enter a settlement account ID below to
              monitor invoices.
            </p>
            <button type="button" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        ) : (
          <div className="auth-layout">
            <form onSubmit={handleRegister} className="auth-form">
              <h3>Create merchant</h3>
              <label>
                Full name
                <input name="register-name" placeholder="Ada Lovelace" disabled={authStatus === 'pending'} required />
              </label>
              <label>
                Email
                <input
                  type="email"
                  name="register-email"
                  placeholder="merchant@example.com"
                  disabled={authStatus === 'pending'}
                  required
                />
              </label>
              <label>
                Password
                <input type="password" name="register-password" disabled={authStatus === 'pending'} required />
              </label>
              <button type="submit" disabled={authStatus === 'pending'}>
                {authStatus === 'pending' ? 'Submitting…' : 'Register & sign in'}
              </button>
            </form>

            <form onSubmit={handleLogin} className="auth-form">
              <h3>Sign in</h3>
              <label>
                Email
                <input type="email" name="login-email" disabled={authStatus === 'pending'} required />
              </label>
              <label>
                Password
                <input type="password" name="login-password" disabled={authStatus === 'pending'} required />
              </label>
              <button type="submit" disabled={authStatus === 'pending'}>
                {authStatus === 'pending' ? 'Verifying…' : 'Sign in'}
              </button>
            </form>
          </div>
        )}
      </section>

      <section aria-labelledby="account-section">
        <h2 id="account-section">Settlement account</h2>
        <form onSubmit={handleAccountSelection}>
          <label>
            Account ID
            <input
              value={accountIdInput}
              onChange={(event) => setAccountIdInput(event.target.value)}
              placeholder="acc_12345"
              disabled={!isAuthenticated}
            />
          </label>
          <button type="submit" disabled={!isAuthenticated || !accountIdInput.trim()}>
            Monitor account
          </button>
        </form>
        <p>
          API: <code>{configuredBaseUrl}</code>
        </p>
      </section>

      <section aria-labelledby="invoice-section">
        <h2 id="invoice-section">Invoice details</h2>
        <form onSubmit={handleCreateInvoice}>
          <label>
            Amount
            <input
              value={form.amountValue}
              onChange={(event) => handleInvoiceFieldChange('amountValue', event.target.value)}
              placeholder="25.00"
              required
              disabled={!canManageInvoices || invoiceStatus === 'pending'}
            />
          </label>
          <label>
            Currency
            <input
              value={form.currency}
              onChange={(event) => handleInvoiceFieldChange('currency', event.target.value)}
              disabled={!canManageInvoices || invoiceStatus === 'pending'}
            />
          </label>
          <label>
            Customer name
            <input
              value={form.customerName}
              onChange={(event) => handleInvoiceFieldChange('customerName', event.target.value)}
              placeholder="Optional"
              disabled={!canManageInvoices || invoiceStatus === 'pending'}
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(event) => handleInvoiceFieldChange('description', event.target.value)}
              placeholder="Notes for the receipt"
              disabled={!canManageInvoices || invoiceStatus === 'pending'}
            />
          </label>
          <button type="submit" disabled={!canManageInvoices || invoiceStatus === 'pending'}>
            {invoiceStatus === 'pending' ? 'Generating…' : 'Create invoice'}
          </button>
        </form>
        <p>
          Share the QR code and invoice memo with the customer. Wallet users should paste the memo into the transfer form so the
          POS can auto-confirm payment.
        </p>
      </section>

      <section aria-labelledby="history-section">
        <h2 id="history-section">Invoice history</h2>
        {invoices.length === 0 ? (
          <p>No invoices yet. Create one to get started.</p>
        ) : (
          <ul className="invoice-list">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="invoice-card">
                <header>
                  <h3>{invoice.reference}</h3>
                  <span className="invoice-status" data-status={invoice.status}>
                    {invoice.status === 'paid' ? 'Paid' : 'Awaiting payment'}
                  </span>
                </header>

                <div className="qr-wrapper">
                  {invoice.qrCodeDataUrl ? (
                    <img src={invoice.qrCodeDataUrl} alt={`QR code for invoice ${invoice.reference}`} />
                  ) : (
                    <p>QR code unavailable.</p>
                  )}
                  <textarea readOnly value={invoice.memo} />
                </div>

                <dl className="details-grid">
                  <div>
                    <dt>Amount</dt>
                    <dd>{formatAmount(invoice)}</dd>
                  </div>
                  <div>
                    <dt>Customer</dt>
                    <dd>{invoice.customerName ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Description</dt>
                    <dd>{invoice.description ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatTimestamp(invoice.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Paid at</dt>
                    <dd>{formatTimestamp(invoice.paidAt)}</dd>
                  </div>
                  <div>
                    <dt>Transaction</dt>
                    <dd>{invoice.paidTransactionId ?? '—'}</dd>
                  </div>
                </dl>

                <div className="invoice-actions">
                  <button type="button" onClick={() => handleCopyMemo(invoice.memo)}>
                    Copy memo
                  </button>
                  {invoice.status === 'paid' && (
                    <button type="button" onClick={() => handleExportReceipt(invoice)}>
                      Export receipt PDF
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
