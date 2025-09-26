import { ForbiddenException } from '@nestjs/common';
import type { Account, MonetaryAmount } from '@qzd/sdk-api/server';

type AccountKycLevel = Account['kycLevel'];

export const ACCOUNT_FROZEN_ERROR = 'ACCOUNT_FROZEN' as const;
export const LIMIT_EXCEEDED_ERROR = 'LIMIT_EXCEEDED' as const;

export type PolicyErrorCode =
  | typeof ACCOUNT_FROZEN_ERROR
  | typeof LIMIT_EXCEEDED_ERROR;

export interface TransferContext {
  account: Account;
  amount: MonetaryAmount;
}

type UsageKey = string;

type Clock = () => Date;

const DAILY_LIMITS_MINOR_UNITS: Record<AccountKycLevel, number> = {
  BASIC: 5000_00,
  FULL: 50000_00,
};

export class PolicyViolationException extends ForbiddenException {
  constructor(public readonly code: PolicyErrorCode, message: string) {
    super({ code, message });
  }
}

export class AccountTransferGuard {
  private readonly usage = new Map<UsageKey, number>();

  constructor(private readonly clock: Clock = () => new Date()) {}

  enforce({ account, amount }: TransferContext): void {
    ensureAccountActive(account);
    const now = this.clock();
    const key = this.buildUsageKey(account.id, amount.currency, now);
    const alreadySpent = this.usage.get(key) ?? 0;
    const requested = toMinorUnits(amount.value);

    ensureWithinDailyLimit(account, requested, alreadySpent);

    this.usage.set(key, alreadySpent + requested);
  }

  getUsage(accountId: string, currency: string, at: Date = this.clock()): number {
    return this.usage.get(this.buildUsageKey(accountId, currency, at)) ?? 0;
  }

  private buildUsageKey(accountId: string, currency: string, at: Date): UsageKey {
    const day = at.toISOString().slice(0, 10);
    return `${accountId}:${currency}:${day}`;
  }
}

export function ensureAccountActive(account: Pick<Account, 'id' | 'status'>): void {
  if (account.status !== 'ACTIVE') {
    throw new PolicyViolationException(
      ACCOUNT_FROZEN_ERROR,
      `Account ${account.id} is frozen and cannot initiate transfers.`,
    );
  }
}

export function ensureWithinDailyLimit(
  account: Pick<Account, 'id' | 'kycLevel'>,
  requestedMinorUnits: number,
  alreadySpentMinorUnits: number,
): void {
  const limit = DAILY_LIMITS_MINOR_UNITS[account.kycLevel];
  if (alreadySpentMinorUnits + requestedMinorUnits > limit) {
    const limitFormatted = formatMinorUnits(limit);
    throw new PolicyViolationException(
      LIMIT_EXCEEDED_ERROR,
      `Daily transfer limit of ${limitFormatted} exceeded for account ${account.id}.`,
    );
  }
}

function toMinorUnits(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`Invalid monetary amount: ${value}`);
  }
  return Math.round(parsed * 100);
}

function formatMinorUnits(minorUnits: number): string {
  const major = minorUnits / 100;
  return `Q${major.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function applyAccountGuards(guard: AccountTransferGuard, context: TransferContext): void {
  guard.enforce(context);
}
