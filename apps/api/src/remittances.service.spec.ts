import { describe, expect, it } from 'vitest';
import type { USRemitAcquireQZDRequest } from '@qzd/sdk-api/server';
import { RemittancesService } from './remittances.service.js';

class SingleSignatureService extends RemittancesService {
  protected override createSignatures(canonical: string) {
    const [first] = super.createSignatures(canonical);
    return first ? [first] : [];
  }
}

const baseRequest: USRemitAcquireQZDRequest = {
  usdAmount: { currency: 'USD', value: '100.00' },
  senderPhone: '+15005550006',
  receiverPhone: '+50255551234',
};

describe('RemittancesService', () => {
  it('simulates quotes for each pricing scenario', () => {
    const clock = () => new Date('2024-05-05T12:00:00Z');
    const service = new RemittancesService(clock);

    const baseline = service.simulateQuote('100.00', 'DEFAULT');
    expect(baseline.quoteId).toBe('quote_default_000001');
    expect(baseline.buyAmount.value).toBe('772.28');
    expect(baseline.rate).toBe('7.7228');

    const tariffed = service.simulateQuote('100.00', 'TARIFFED');
    expect(tariffed.quoteId).toBe('quote_tariffed_000002');
    expect(tariffed.buyAmount.value).toBe('756.60');
    expect(tariffed.rate).toBe('7.5660');

    const subsidized = service.simulateQuote('100.00', 'SUBSIDIZED');
    expect(subsidized.quoteId).toBe('quote_subsidized_000003');
    expect(subsidized.buyAmount.value).toBe('780.00');
    expect(subsidized.rate).toBe('7.8000');
  });

  it('mints QZD with multisig signatures', () => {
    const clock = () => new Date('2024-05-05T12:00:00Z');
    const service = new RemittancesService(clock);

    const transaction = service.acquireQzd(baseRequest);
    expect(transaction.amount.value).toBe('772.28');
    expect(transaction.status).toBe('posted');

    const [entry] = service
      .getLedgerHistory()
      .slice(-1);
    expect(entry?.type).toBe('ISSUE');
    expect(entry?.sigs.length).toBe(2);
    expect(entry?.amount).toBe(77228);
  });

  it('rejects issuances without sufficient signatures', () => {
    const clock = () => new Date('2024-05-05T12:00:00Z');
    const service = new SingleSignatureService(clock);

    expect(() => service.acquireQzd(baseRequest)).toThrowError('Invalid issuance signatures');
  });
});

