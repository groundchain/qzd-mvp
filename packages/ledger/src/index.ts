import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';

export type AccountStatus = 'ACTIVE' | 'FROZEN';
export type KycLevel = 'BASIC' | 'FULL';
export type LedgerEntryType = 'ISSUE' | 'TRANSFER' | 'REDEEM' | 'ADJUST';

export interface Account {
  id: string;
  alias: string;
  kyc_level: KycLevel;
  status: AccountStatus;
  public_key: string;
}

export interface LedgerSignature {
  validatorId: string;
  signature: string;
}

export interface LedgerEntryMeta {
  [key: string]: unknown;
}

export interface LedgerEntry {
  id: number;
  ts: string;
  type: LedgerEntryType;
  amount: number;
  asset: string;
  from_account: string | null;
  to_account: string | null;
  memo: string | null;
  tx_hash: string;
  sigs: LedgerSignature[];
  meta: LedgerEntryMeta;
}

export interface LedgerValidator {
  id: string;
  publicKey: string;
}

export interface LedgerConfig {
  issuanceValidators: LedgerValidator[];
  issuanceThreshold?: number;
}

export interface AccountInput {
  alias: string;
  kyc_level: KycLevel;
  public_key: string;
  status?: AccountStatus;
}

export interface PostEntryInput {
  type: LedgerEntryType;
  amount: number;
  asset: string;
  from_account?: string | null;
  to_account?: string | null;
  memo?: string | null;
  sigs?: LedgerSignature[];
  meta?: LedgerEntryMeta;
  ts?: string | Date;
}

export type MultisigValidationInput = {
  canonical: string;
  signatures: LedgerSignature[];
  validators: LedgerValidator[];
  threshold: number;
};

export type CanonicalPayload = Record<string, unknown>;

export class AppendOnlyLedger {
  private readonly accounts = new Map<string, Account>();
  private readonly accountsByAlias = new Map<string, Account>();
  private readonly entries: LedgerEntry[] = [];
  private readonly issuanceValidators: LedgerValidator[];
  private readonly issuanceThreshold: number;
  private accountSeq = 0;

  constructor(config: LedgerConfig) {
    this.issuanceValidators = config.issuanceValidators;
    const threshold = config.issuanceThreshold ?? 2;
    if (threshold < 1 || threshold > this.issuanceValidators.length) {
      throw new Error('Invalid issuance threshold configuration');
    }
    this.issuanceThreshold = threshold;
  }

  openAccount(input: AccountInput): Account {
    if (this.accountsByAlias.has(input.alias)) {
      throw new Error('Account alias already exists');
    }
    const id = `${++this.accountSeq}`;
    const account: Account = {
      id,
      alias: input.alias,
      kyc_level: input.kyc_level,
      status: input.status ?? 'ACTIVE',
      public_key: input.public_key,
    };
    this.accounts.set(id, account);
    this.accountsByAlias.set(account.alias, account);
    return account;
  }

  getAccount(id: string): Account | undefined {
    return this.accounts.get(id);
  }

  postEntry(input: PostEntryInput): LedgerEntry {
    validateEntryInput(input);

    const fromAccount = input.from_account ? this.assertActiveAccount(input.from_account, 'from_account') : null;
    const toAccount = input.to_account ? this.assertActiveAccount(input.to_account, 'to_account') : null;

    const now = input.ts ? new Date(input.ts).toISOString() : new Date().toISOString();

    if (input.type === 'TRANSFER' || input.type === 'REDEEM') {
      if (!fromAccount) {
        throw new Error('from_account is required');
      }
      const balance = this.getAccountBalance(fromAccount.id, input.asset);
      if (balance < input.amount) {
        throw new Error('Insufficient balance');
      }
    }

    const canonical = canonicalizeEntryPayload(input);

    if (input.type === 'ISSUE') {
      const isValid = validateMultisig({
        canonical,
        signatures: input.sigs ?? [],
        validators: this.issuanceValidators,
        threshold: this.issuanceThreshold,
      });
      if (!isValid) {
        throw new Error('Invalid issuance signatures');
      }
    }

    if (input.type === 'REDEEM' && !fromAccount) {
      throw new Error('Redeem requires from_account');
    }

    const txHash = bytesToHex(sha256(new TextEncoder().encode(canonical)));

    const entry: LedgerEntry = {
      id: this.entries.length + 1,
      ts: now,
      type: input.type,
      amount: input.amount,
      asset: input.asset,
      from_account: fromAccount?.id ?? null,
      to_account: toAccount?.id ?? null,
      memo: input.memo ?? null,
      tx_hash: txHash,
      sigs: input.sigs ?? [],
      meta: input.meta ?? {},
    };

    this.entries.push(entry);
    return entry;
  }

  getAccountBalance(accountId: string, asset: string): number {
    let balance = 0;
    for (const entry of this.entries) {
      if (entry.asset !== asset) continue;
      switch (entry.type) {
        case 'ISSUE':
          if (entry.to_account === accountId) {
            balance += entry.amount;
          }
          break;
        case 'TRANSFER':
          if (entry.from_account === accountId) {
            balance -= entry.amount;
          }
          if (entry.to_account === accountId) {
            balance += entry.amount;
          }
          break;
        case 'REDEEM':
          if (entry.from_account === accountId) {
            balance -= entry.amount;
          }
          break;
        case 'ADJUST':
          if (entry.from_account === accountId) {
            balance -= entry.amount;
          }
          if (entry.to_account === accountId) {
            balance += entry.amount;
          }
          break;
      }
    }
    return balance;
  }

  getHistory(accountId?: string): LedgerEntry[] {
    if (!accountId) {
      return [...this.entries];
    }
    return this.entries.filter(
      (entry) => entry.from_account === accountId || entry.to_account === accountId,
    );
  }

  private assertActiveAccount(accountId: string, field: 'from_account' | 'to_account'): Account {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Unknown ${field}`);
    }
    if (account.status !== 'ACTIVE') {
      throw new Error(`Account ${account.id} is not active`);
    }
    return account;
  }
}

export function validateMultisig(input: MultisigValidationInput): boolean {
  if (input.threshold < 1 || input.threshold > input.validators.length) {
    return false;
  }
  if (input.signatures.length < input.threshold) {
    return false;
  }

  const digest = sha256(new TextEncoder().encode(input.canonical));
  const validatorMap = new Map(input.validators.map((v) => [v.id, v.publicKey]));
  const seen = new Set<string>();
  let verified = 0;

  for (const sig of input.signatures) {
    if (seen.has(sig.validatorId)) {
      continue;
    }
    const validatorKey = validatorMap.get(sig.validatorId);
    if (!validatorKey) {
      continue;
    }
    const signatureBytes = hexToBytes(sig.signature);
    if (secp256k1.verify(signatureBytes, digest, hexToBytes(validatorKey))) {
      seen.add(sig.validatorId);
      verified += 1;
      if (verified >= input.threshold) {
        return true;
      }
    }
  }
  return verified >= input.threshold;
}

export function canonicalizeEntryPayload(input: PostEntryInput): string {
  const payload: CanonicalPayload = {
    type: input.type,
    amount: input.amount,
    asset: input.asset,
    from_account: input.from_account ?? null,
    to_account: input.to_account ?? null,
    memo: input.memo ?? null,
    meta: input.meta ?? {},
    ts: input.ts ? new Date(input.ts).toISOString() : undefined,
  };
  return canonicalJSONString(payload);
}

function validateEntryInput(input: PostEntryInput) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error('Amount must be a positive integer');
  }
  if (!input.asset) {
    throw new Error('Asset is required');
  }
  switch (input.type) {
    case 'ISSUE':
      if (!input.to_account) {
        throw new Error('Issue requires to_account');
      }
      break;
    case 'TRANSFER':
      if (!input.from_account || !input.to_account) {
        throw new Error('Transfer requires from_account and to_account');
      }
      if (input.from_account === input.to_account) {
        throw new Error('Transfer accounts must differ');
      }
      break;
    case 'REDEEM':
      if (!input.from_account) {
        throw new Error('Redeem requires from_account');
      }
      if (input.to_account) {
        throw new Error('Redeem cannot specify to_account');
      }
      break;
    case 'ADJUST':
      if (!input.from_account && !input.to_account) {
        throw new Error('Adjust requires at least one account');
      }
      break;
    default:
      throw new Error('Unsupported entry type');
  }
}

function canonicalJSONString(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const result: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      result[key] = canonicalize(val);
    }
    return result;
  }
  return value;
}

export type { LedgerEntry as Entry, Account as LedgerAccount };
