import { describe, expect, it } from 'vitest';
import type { USRemitAcquireQZDRequest } from '@qzd/sdk-api/server';
import { RemittancesService, type QuoteScenario } from './remittances.service.js';

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

type RemittanceInternals = {
  calculateFeeMinorUnits: (amountMinorUnits: number, scenario: QuoteScenario) => number;
  calculateBuyMinorUnits: (netMinorUnits: number) => number;
  formatRate: (buyMinorUnits: number, sellMinorUnits: number) => string;
  formatMinorUnits: (value: number) => string;
};

function getInternals(service: RemittancesService): RemittanceInternals {
  return service as unknown as RemittanceInternals;
}

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

  it('computes deterministic fees across pricing scenarios', () => {
    const service = new RemittancesService();
    const internals = getInternals(service);

    expect(internals.calculateFeeMinorUnits(50, 'DEFAULT')).toBe(50);
    expect(internals.calculateFeeMinorUnits(5_000, 'DEFAULT')).toBe(99);
    expect(internals.calculateFeeMinorUnits(5_000, 'TARIFFED')).toBe(150);
    expect(internals.calculateFeeMinorUnits(12_345, 'TARIFFED')).toBe(370);
    expect(internals.calculateFeeMinorUnits(7_654, 'SUBSIDIZED')).toBe(0);
  });

  it('rounds corridor conversions and rates consistently', () => {
    const clock = () => new Date('2024-05-05T12:00:00Z');
    const service = new RemittancesService(clock);
    const internals = getInternals(service);

    const amountMinorUnits = 10_000; // $100.00
    const fee = internals.calculateFeeMinorUnits(amountMinorUnits, 'DEFAULT');
    const net = amountMinorUnits - fee;
    const buy = internals.calculateBuyMinorUnits(net);

    expect(fee).toBe(99);
    expect(net).toBe(9_901);
    expect(buy).toBe(77_228);
    expect(internals.calculateBuyMinorUnits(501)).toBe(3_908);

    const rate = internals.formatRate(buy, amountMinorUnits);
    expect(rate).toBe('7.7228');
    expect(internals.formatRate(buy, 0)).toBe('0.0000');

    expect(internals.formatMinorUnits(amountMinorUnits)).toBe('100.00');
    expect(internals.formatMinorUnits(buy)).toBe('772.28');

    const quote = service.simulateQuote('100.00');
    expect(new Date(quote.expiresAt).toISOString()).toBe('2024-05-05T12:05:00.000Z');
  });
});

