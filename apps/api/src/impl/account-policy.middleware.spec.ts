import { describe, expect, it } from 'vitest';
import type { Account, MonetaryAmount } from '@qzd/sdk-api/server';
import {
  ACCOUNT_FROZEN_ERROR,
  AccountTransferGuard,
  LIMIT_EXCEEDED_ERROR,
  PolicyViolationException,
} from './account-policy.middleware.js';

const baseAccount: Account = {
  id: 'acc_001',
  ownerId: 'usr_001',
  ownerName: 'Test User',
  status: 'ACTIVE',
  kycLevel: 'BASIC',
  createdAt: '2024-05-01T00:00:00.000Z',
  metadata: {},
};

const amount = (value: string): MonetaryAmount => ({
  currency: 'QZD',
  value,
});

describe('AccountTransferGuard', () => {
  it('enforces BASIC daily transfer limits', () => {
    const guard = new AccountTransferGuard(() => new Date('2024-05-05T12:00:00Z'));
    guard.enforce({ account: baseAccount, amount: amount('3000.00') });

    let thrown: unknown;
    try {
      guard.enforce({ account: baseAccount, amount: amount('2500.00') });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(PolicyViolationException);
    const violation = thrown as PolicyViolationException;
    expect(violation.code).toBe(LIMIT_EXCEEDED_ERROR);
    expect(violation.getResponse()).toMatchObject({ code: LIMIT_EXCEEDED_ERROR });
  });

  it('blocks frozen accounts before evaluating limits', () => {
    const guard = new AccountTransferGuard(() => new Date('2024-05-05T12:00:00Z'));
    const frozenAccount: Account = { ...baseAccount, status: 'FROZEN' };

    let thrown: unknown;
    try {
      guard.enforce({ account: frozenAccount, amount: amount('10.00') });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(PolicyViolationException);
    const violation = thrown as PolicyViolationException;
    expect(violation.code).toBe(ACCOUNT_FROZEN_ERROR);
    expect(violation.getResponse()).toMatchObject({ code: ACCOUNT_FROZEN_ERROR });
    expect(guard.getUsage(frozenAccount.id, 'QZD')).toBe(0);
  });
});
