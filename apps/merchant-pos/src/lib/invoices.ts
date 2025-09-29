import type { Transaction } from '@qzd/sdk-browser';

export type InvoiceStatus = 'pending' | 'paid';

export interface InvoiceInput {
  accountId: string;
  amountValue: string;
  currency: string;
  description?: string;
  customerName?: string;
}

export interface Invoice {
  id: string;
  accountId: string;
  amount: {
    value: string;
    currency: string;
  };
  description?: string;
  customerName?: string;
  reference: string;
  memo: string;
  createdAt: string;
  status: InvoiceStatus;
  paidTransactionId?: string;
  paidAt?: string | Date;
  qrCodeDataUrl?: string;
}

export interface PaymentMatch {
  invoiceId: string;
  transactionId: string;
  paidAt: string | Date;
}

function sanitizeDecimal(input: string): string {
  return Number.parseFloat(input).toFixed(2);
}

export function generateInvoiceId(): string {
  const randomSuffix = Math.random().toString(16).slice(2, 10);
  return `inv_${Date.now()}_${randomSuffix}`;
}

export function createInvoice(input: InvoiceInput): Invoice {
  const accountId = input.accountId.trim();
  if (!accountId) {
    throw new Error('Account ID is required');
  }

  const amountValue = input.amountValue.trim();
  if (!amountValue) {
    throw new Error('Invoice amount is required');
  }

  const currency = (input.currency || 'QZD').trim().toUpperCase();
  const amountNumber = Number.parseFloat(amountValue);
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    throw new Error('Invoice amount must be a positive decimal');
  }

  const id = generateInvoiceId();
  const reference = `INV-${id.slice(4, 10).toUpperCase()}`;

  return {
    id,
    accountId,
    amount: {
      value: sanitizeDecimal(amountValue),
      currency,
    },
    description: input.description?.trim() || undefined,
    customerName: input.customerName?.trim() || undefined,
    reference,
    memo: `Invoice ${reference}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
  } satisfies Invoice;
}

export function encodeInvoicePayload(invoice: Invoice): string {
  const payload = {
    type: 'qzd.invoice.v1',
    invoiceId: invoice.id,
    accountId: invoice.accountId,
    amount: invoice.amount,
    reference: invoice.reference,
    memo: invoice.memo,
    description: invoice.description,
    customerName: invoice.customerName,
  };

  return JSON.stringify(payload);
}

export function transactionMatchesInvoice(transaction: Transaction, invoice: Invoice): boolean {
  if (!transaction || !invoice) {
    return false;
  }

  if (transaction.accountId !== invoice.accountId) {
    return false;
  }

  if (transaction.status !== 'posted') {
    return false;
  }

  const amountMatches =
    transaction.amount?.currency === invoice.amount.currency &&
    transaction.amount?.value === invoice.amount.value;

  if (!amountMatches) {
    return false;
  }

  const memo = transaction.metadata?.memo ?? '';
  return memo.includes(invoice.reference);
}

export function buildPaymentMatch(transaction: Transaction, invoice: Invoice): PaymentMatch {
  return {
    invoiceId: invoice.id,
    transactionId: transaction.id,
    paidAt: transaction.createdAt,
  };
}
