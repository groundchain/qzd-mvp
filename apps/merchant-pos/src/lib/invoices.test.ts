import type { Transaction } from '@qzd/sdk-browser';
import { describe, expect, it, vi } from 'vitest';
import {
  createInvoice,
  encodeInvoicePayload,
  transactionMatchesInvoice,
  type InvoiceInput,
} from './invoices';

vi.stubGlobal('crypto', {
  randomUUID: () => '123e4567-e89b-12d3-a456-426614174000',
});

function buildTransaction(partial: Partial<Transaction>): Transaction {
  return {
    id: 'txn_1',
    accountId: 'acc_merchant',
    type: 'transfer',
    status: 'posted',
    amount: { value: '25.00', currency: 'QZD' },
    createdAt: new Date().toISOString(),
    ...partial,
  } as Transaction;
}

describe('invoices helpers', () => {
  const baseInput: InvoiceInput = {
    accountId: 'acc_merchant',
    amountValue: '25',
    currency: 'qzd',
  };

  it('creates invoices with normalized values', () => {
    const invoice = createInvoice(baseInput);
    expect(invoice.accountId).toBe(baseInput.accountId);
    expect(invoice.amount.value).toBe('25.00');
    expect(invoice.amount.currency).toBe('QZD');
    expect(invoice.reference).toMatch(/^INV-/);
    expect(invoice.status).toBe('pending');
  });

  it('encodes QR payloads as JSON strings', () => {
    const invoice = createInvoice(baseInput);
    const payload = encodeInvoicePayload(invoice);
    expect(() => JSON.parse(payload)).not.toThrow();
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({
      type: 'qzd.invoice.v1',
      invoiceId: invoice.id,
      reference: invoice.reference,
      amount: invoice.amount,
    });
  });

  it('matches transactions when memo includes the invoice reference', () => {
    const invoice = createInvoice(baseInput);
    const transaction = buildTransaction({
      metadata: { memo: `Invoice ${invoice.reference}` },
    });

    expect(transactionMatchesInvoice(transaction, invoice)).toBe(true);
  });

  it('does not match when memo is missing the reference', () => {
    const invoice = createInvoice(baseInput);
    const transaction = buildTransaction({ metadata: { memo: 'Different memo' } });

    expect(transactionMatchesInvoice(transaction, invoice)).toBe(false);
  });
});
