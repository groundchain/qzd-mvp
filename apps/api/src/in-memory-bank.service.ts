import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { ed25519 } from '@noble/curves/ed25519';
import { hexToBytes } from '@noble/curves/abstract/utils';
import type {
  AgentCashInRequest,
  AgentCashOutRequest,
  Account,
  Alert,
  Balance,
  CreateAccountRequest,
  IssueRequest,
  IssuanceRequest,
  IssueTokensRequest,
  ListAccountTransactions200Response,
  LoginUser200Response,
  LoginUserRequest,
  MonetaryAmount,
  OfflineVoucher,
  RegisterUser201Response,
  RegisterUserRequest,
  SignIssuanceRequestRequest,
  Transaction,
  TransferRequest,
  Voucher,
  SmsInboundRequest,
  SmsInboundResponse,
  UploadAccountKycRequest,
} from '@qzd/sdk-api/server';
import { createOfflineVoucherPayload } from '@qzd/card-mock';
import { RequestSecurityManager, type ValidatedMutationContext } from './request-security.js';
import { recordTransactionMetric } from './observability/metrics.js';

type AccountStatus = Account['status'];
type KycLevel = Account['kycLevel'];

type UserRecord = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  accountId: string;
};

type AccountRecord = {
  id: string;
  ownerId: string;
  ownerName: string;
  status: AccountStatus;
  kycLevel: KycLevel;
  createdAt: string;
  currency: string;
  balance: number;
  updatedAt: string;
  openingBalance: number;
};

type TransactionRecord = Transaction;

type TokenRecord = {
  token: string;
  userId: string;
  expiresAt: number;
};

type IssuanceStatus = 'pending' | 'collecting' | 'ready' | 'completed';

type IssuanceRequestRecord = {
  id: string;
  accountId: string;
  currency: string;
  amount: number;
  required: number;
  collected: Set<string>;
  status: IssuanceStatus;
  reference?: string;
};

type VoucherStatus = Voucher['status'];

type VoucherRecord = {
  code: string;
  accountId: string;
  currency: string;
  amount: number;
  fee: number;
  status: VoucherStatus;
  createdAt: string;
  redeemedAt?: string;
  metadata: Record<string, string>;
};

type OfflineVoucherStatus = OfflineVoucher['status'];

type OfflineVoucherRecord = {
  id: string;
  fromCardId: string;
  toAccountId: string;
  currency: string;
  amount: number;
  nonce: string;
  signature: string;
  expiresAt: string;
  status: OfflineVoucherStatus;
  createdAt: string;
  redeemedAt?: string;
};

type AlertSeverity = Alert['severity'];

type AlertRecord = {
  id: string;
  severity: AlertSeverity;
  rule: string;
  ts: string;
  details: Record<string, unknown>;
  acknowledged: boolean;
  key: string;
};

type TransactionJob = {
  kind: 'agent_cash_in' | 'transfer' | 'issuance';
  snapshot: Record<string, unknown>;
  execute: (transactionId: string) => TransactionRecord;
  onSuccess?: (transaction: TransactionRecord) => void;
  onRecovered?: (transaction: TransactionRecord) => void;
};

type TransactionJournalStatus = 'pending' | 'posted' | 'failed';

interface TransactionJournalRecord {
  scope: string;
  bodyHash: string;
  transactionId: string;
  status: TransactionJournalStatus;
  attempts: number;
  job?: TransactionJob;
  response?: TransactionRecord;
  lastError?: DeadLetterError;
}

interface DeadLetterError {
  name: string;
  message: string;
  stack?: string;
}

interface DeadLetterRecord {
  scope: string;
  jobKind: TransactionJob['kind'];
  failedAt: string;
  attempts: number;
  error: DeadLetterError;
  snapshot: Record<string, unknown>;
}

type TransferEvent = {
  amount: number;
  timestamp: number;
};

type AccountCreationEvent = {
  accountId: string;
  timestamp: number;
};

const DEFAULT_BALANCE = 1_000;
const TOKEN_TTL_MS = 60 * 60 * 1000;
const DEFAULT_CURRENCY = 'QZD';
const ISSUANCE_SIGNATURE_THRESHOLD = 2;
const STRUCTURING_THRESHOLD = 100;
const STRUCTURING_MARGIN = 5;
const STRUCTURING_COUNT = 3;
const STRUCTURING_WINDOW_MS = 15 * 60 * 1000;
const VELOCITY_COUNT = 5;
const VELOCITY_WINDOW_MS = 2 * 60 * 1000;
const NEW_ACCOUNT_THRESHOLD = 5;
const NEW_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;
const HEX_PATTERN = /^([0-9a-fA-F]{2})+$/;

@Injectable()
export class InMemoryBankService {
  private readonly usersByEmail = new Map<string, UserRecord>();
  private readonly usersById = new Map<string, UserRecord>();
  private readonly accounts = new Map<string, AccountRecord>();
  private readonly transactions = new Map<string, TransactionRecord[]>();
  private readonly tokens = new Map<string, TokenRecord>();
  private readonly issuanceRequests = new Map<string, IssuanceRequestRecord>();
  private readonly issuanceOrder: string[] = [];
  private readonly vouchers = new Map<string, VoucherRecord>();
  private readonly offlineVouchers = new Map<string, OfflineVoucherRecord>();
  private readonly offlineVoucherNonces = new Map<string, string>();
  private readonly offlineCardPublicKeys = new Map<string, Uint8Array>();
  private readonly smsAccounts = new Map<string, string>();
  private readonly security = new RequestSecurityManager();
  private readonly alerts = new Map<string, AlertRecord>();
  private readonly alertOrder: string[] = [];
  private readonly activeAlertKeys = new Set<string>();
  private readonly transferEvents = new Map<string, TransferEvent[]>();
  private readonly accountCreationEvents: AccountCreationEvent[] = [];
  private readonly transactionJournals = new Map<string, TransactionJournalRecord>();
  private readonly deadLetterQueue = new Map<string, DeadLetterRecord>();

  private userSequence = 1;
  private accountSequence = 1;
  private transactionSequence = 1;
  private issuanceSequence = 1;
  private voucherSequence = 1;
  private alertSequence = 1;
  private crashNextTransaction = false;

  registerUser(request: RegisterUserRequest, actor: Request): RegisterUser201Response {
    const context = this.security.validateMutation(actor, request);
    return this.security.applyIdempotency(context, () => {
      const email = request.email?.trim().toLowerCase();
      const password = request.password?.trim();
      const fullName = request.fullName?.trim();

      if (!email || !password || !fullName) {
        throw new BadRequestException('email, password, and fullName are required');
      }

      if (this.usersByEmail.has(email)) {
        throw new ConflictException('An account with this email already exists');
      }

      const userId = this.buildId('usr', this.userSequence++);
      const accountId = this.buildId('acct', this.accountSequence++);
      const createdAt = new Date().toISOString();

      const user: UserRecord = {
        id: userId,
        email,
        password,
        fullName,
        accountId,
      };

      const account: AccountRecord = {
        id: accountId,
        ownerId: userId,
        ownerName: fullName,
        status: 'ACTIVE',
        kycLevel: 'BASIC',
        createdAt,
        currency: DEFAULT_CURRENCY,
        balance: DEFAULT_BALANCE,
        updatedAt: createdAt,
        openingBalance: DEFAULT_BALANCE,
      };

      this.usersByEmail.set(email, user);
      this.usersById.set(userId, user);
      this.accounts.set(accountId, account);
      this.transactions.set(accountId, []);

      this.recordAccountCreation(accountId, createdAt);

      const token = this.issueToken(userId);

      return {
        userId,
        account: this.toAccount(account),
        token,
      } satisfies RegisterUser201Response;
    });
  }

  loginUser(request: LoginUserRequest, actor: Request): LoginUser200Response {
    const context = this.security.validateMutation(actor, request);
    return this.security.applyIdempotency(context, () => {
      const email = request.email?.trim().toLowerCase();
      const password = request.password?.trim();

      if (!email || !password) {
        throw new BadRequestException('email and password are required');
      }

      const user = this.usersByEmail.get(email);
      if (!user || user.password !== password) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const token = this.issueToken(user.id);
      return {
        token,
        expiresIn: TOKEN_TTL_MS / 1000,
      } satisfies LoginUser200Response;
    });
  }

  createAccount(request: CreateAccountRequest, actor: Request): Account {
    const context = this.security.validateMutation(actor, request);
    const user = this.requireUser(actor);
    return this.security.applyIdempotency(context, () => {
      const ownerName = request.displayName?.trim() || user.fullName;
      const status: AccountStatus = 'ACTIVE';
      const kycLevel: KycLevel = 'BASIC';

      const accountId = this.buildId('acct', this.accountSequence++);
      const createdAt = new Date().toISOString();

      const account: AccountRecord = {
        id: accountId,
        ownerId: user.id,
        ownerName,
        status,
        kycLevel,
        createdAt,
        currency: DEFAULT_CURRENCY,
        balance: 0,
        updatedAt: createdAt,
        openingBalance: 0,
      };

      this.accounts.set(accountId, account);
      this.transactions.set(accountId, []);

      this.recordAccountCreation(accountId, createdAt);

      return this.toAccount(account);
    });
  }

  updateAccountKyc(request: UploadAccountKycRequest, actor: Request): Account {
    const context = this.security.validateMutation(actor, request);
    const user = this.requireUser(actor);
    return this.security.applyIdempotency(context, () => {
      const accountId = request.accountId?.trim();
      const kycLevel = request.kycLevel;

      if (!accountId || !kycLevel) {
        throw new BadRequestException('accountId and kycLevel are required');
      }

      const account = this.requireAccount(accountId);
      if (account.ownerId !== user.id) {
        throw new ForbiddenException('You do not have access to this account');
      }

      account.kycLevel = kycLevel;
      account.updatedAt = new Date().toISOString();

      return this.toAccount(account);
    });
  }

  getAccountBalance(accountId: string, actor: Request): Balance {
    const account = this.requireAccount(accountId);
    const user = this.requireUser(actor);
    if (account.ownerId !== user.id) {
      throw new ForbiddenException('You do not have access to this account');
    }

    return this.toBalance(account);
  }

  listAccountTransactions(
    accountId: string,
    actor: Request,
    limit = 25,
    cursor?: string,
  ): ListAccountTransactions200Response {
    if (limit <= 0) {
      throw new BadRequestException('limit must be positive');
    }

    const account = this.requireAccount(accountId);
    const user = this.requireUser(actor);
    if (account.ownerId !== user.id) {
      throw new ForbiddenException('You do not have access to this account');
    }

    const history = this.transactions.get(accountId) ?? [];

    const startIndex = cursor ? this.findCursorIndex(history, cursor) + 1 : 0;
    const slice = history.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < history.length ? history[startIndex + limit - 1]?.id ?? null : null;

    return {
      items: slice,
      nextCursor: nextCursor ?? null,
    } satisfies ListAccountTransactions200Response;
  }

  agentCashIn(request: AgentCashInRequest, actor: Request): Transaction {
    const context = this.security.validateMutation(actor, request);
    const user = this.requireUser(actor);
    const accountId = request.accountId?.trim();
    const amountValue = request.amount?.value?.trim();

    if (!accountId || !amountValue) {
      throw new BadRequestException('accountId and amount are required');
    }

    const account = this.requireAccount(accountId);
    if (account.ownerId !== user.id) {
      throw new ForbiddenException('You do not have access to this account');
    }

    const currency = request.amount?.currency?.trim() || account.currency;
    if (currency !== account.currency) {
      throw new BadRequestException('Currency mismatch with account');
    }

    const amount = this.parsePositiveAmount(amountValue);
    const memo = request.memo?.trim();

    return this.processTransaction(context, () => {
      const snapshot: Record<string, unknown> = {
        accountId: account.id,
        amount,
        currency,
      };
      if (memo) {
        snapshot.memo = memo;
      }

      return {
        kind: 'agent_cash_in',
        snapshot,
        execute: (transactionId: string) => {
          const createdAt = new Date().toISOString();
          account.balance = this.round(account.balance + amount);
          account.updatedAt = createdAt;

          const metadata: Record<string, string> = { direction: 'incoming' };
          if (memo) {
            metadata.memo = memo;
          }

          const transaction: Transaction = {
            id: transactionId,
            accountId: account.id,
            type: 'credit',
            status: 'posted',
            amount: this.monetary(amount, currency),
            createdAt,
            metadata,
          } satisfies Transaction;

          this.prependTransaction(account.id, transaction);

          return transaction;
        },
      } satisfies TransactionJob;
    });
  }

  agentCashOut(request: AgentCashOutRequest, actor: Request): Voucher {
    const context = this.security.validateMutation(actor, request);
    const user = this.requireUser(actor);
    return this.security.applyIdempotency(context, () => {
      const accountId = request.accountId?.trim();
      const amountValue = request.amount?.value?.trim();

      if (!accountId || !amountValue) {
        throw new BadRequestException('accountId and amount are required');
      }

      const account = this.requireAccount(accountId);
      if (account.ownerId !== user.id) {
        throw new ForbiddenException('You do not have access to this account');
      }

      const currency = request.amount?.currency?.trim() || account.currency;
      if (currency !== account.currency) {
        throw new BadRequestException('Currency mismatch with account');
      }

      const amount = this.parsePositiveAmount(amountValue);
      const fee = this.round(amount * 0.005);
      const totalDebited = this.round(amount + fee);
      if (account.balance < totalDebited) {
        throw new BadRequestException('Insufficient funds');
      }

      const createdAt = new Date().toISOString();
      account.balance = this.round(account.balance - totalDebited);
      account.updatedAt = createdAt;

      const code = this.generateVoucherCode();
      const memo = request.memo?.trim();
      const transactionMetadata: Record<string, string> = {
        voucherCode: code,
        feeValue: fee.toFixed(2),
        feeCurrency: currency,
        direction: 'outgoing',
      };
      if (memo) {
        transactionMetadata.memo = memo;
      }

      const transaction: Transaction = {
        id: this.buildId('txn', this.transactionSequence++),
        accountId: account.id,
        type: 'debit',
        status: 'posted',
        amount: this.monetary(totalDebited, currency),
        createdAt,
        metadata: transactionMetadata,
      } satisfies Transaction;

      this.prependTransaction(account.id, transaction);

      const voucherMetadata: Record<string, string> = {
        feeValue: fee.toFixed(2),
        feeCurrency: currency,
      };
      if (memo) {
        voucherMetadata.memo = memo;
      }

      const record: VoucherRecord = {
        code,
        accountId: account.id,
        currency,
        amount,
        fee,
        status: 'issued',
        createdAt,
        metadata: voucherMetadata,
      } satisfies VoucherRecord;

      this.vouchers.set(code, record);

      return this.toVoucher(record);
    });
  }

  redeemVoucher(code: string, actor: Request): Voucher {
    const context = this.security.validateMutation(actor, undefined);
    this.requireUser(actor);
    return this.security.applyIdempotency(context, () => {
      const normalizedCode = code?.trim();
      if (!normalizedCode) {
        throw new BadRequestException('code is required');
      }

      const record = this.requireVoucher(normalizedCode);
      if (record.status === 'redeemed') {
        throw new ConflictException('Voucher already redeemed');
      }

      const redeemedAt = new Date().toISOString();
      record.status = 'redeemed';
      record.redeemedAt = redeemedAt;

      const account = this.requireAccount(record.accountId);
      const redemptionMetadata: Record<string, string> = {
        voucherCode: record.code,
        direction: 'incoming',
      };
      if (record.metadata.memo) {
        redemptionMetadata.memo = record.metadata.memo;
      }
      if (record.metadata.feeValue) {
        redemptionMetadata.feeValue = record.metadata.feeValue;
      }
      if (record.metadata.feeCurrency) {
        redemptionMetadata.feeCurrency = record.metadata.feeCurrency;
      }
      redemptionMetadata.redemptionEvent = 'voucher_redeemed';

      const transaction: Transaction = {
        id: this.buildId('txn', this.transactionSequence++),
        accountId: account.id,
        type: 'redemption',
        status: 'posted',
        amount: this.monetary(record.amount, record.currency),
        createdAt: redeemedAt,
        metadata: redemptionMetadata,
      } satisfies Transaction;

      this.prependTransaction(account.id, transaction);

      return this.toVoucher(record);
    });
  }

  registerOfflineCard(cardId: string, publicKeyHex: string): void {
    const normalizedId = cardId?.trim();
    const normalizedKey = publicKeyHex?.trim();
    if (!normalizedId) {
      throw new Error('cardId is required to register an offline card');
    }
    if (!normalizedKey || !HEX_PATTERN.test(normalizedKey)) {
      throw new Error('publicKeyHex must be a hex-encoded string');
    }

    this.offlineCardPublicKeys.set(normalizedId, hexToBytes(normalizedKey));
  }

  createOfflineVoucher(request: OfflineVoucher, actor: Request): OfflineVoucher {
    const context = this.security.validateMutation(actor, request);
    const user = this.requireUser(actor);
    return this.security.applyIdempotency(context, () => {
      const id = request.id?.trim();
      const fromCardId = request.fromCardId?.trim();
      const toAccountId = request.toAccountId?.trim();
      const nonce = request.nonce?.trim();
      const signature = request.signature?.trim();
      const expiresAtRaw = request.expiresAt?.trim();
      const amountValueRaw = request.amount?.value;
      const amountCurrencyRaw = request.amount?.currency;
      const status = request.status?.trim();

      if (!id) {
        throw new BadRequestException('id is required');
      }
      if (this.offlineVouchers.has(id)) {
        throw new ConflictException('Offline voucher already registered');
      }
      if (!fromCardId) {
        throw new BadRequestException('fromCardId is required');
      }
      if (!toAccountId) {
        throw new BadRequestException('toAccountId is required');
      }
      if (!nonce) {
        throw new BadRequestException('nonce is required');
      }
      if (!signature) {
        throw new BadRequestException('signature is required');
      }
      if (!expiresAtRaw) {
        throw new BadRequestException('expiresAt is required');
      }
      if (status && status !== 'pending') {
        throw new BadRequestException('status must be pending during registration');
      }

      const amountValue = amountValueRaw?.trim();
      if (!amountValue) {
        throw new BadRequestException('amount value is required');
      }

      const account = this.requireAccount(toAccountId);
      if (account.ownerId !== user.id) {
        throw new ForbiddenException('You do not have access to this account');
      }

      const currency = amountCurrencyRaw?.trim() || account.currency;
      if (currency !== account.currency) {
        throw new BadRequestException('Currency mismatch with account');
      }

      const nonceKey = `${fromCardId}:${nonce}`;
      if (this.offlineVoucherNonces.has(nonceKey)) {
        throw new ConflictException('Offline voucher nonce already used');
      }

      if (!HEX_PATTERN.test(signature)) {
        throw new BadRequestException('signature must be a hex-encoded string');
      }

      const publicKey = this.offlineCardPublicKeys.get(fromCardId);
      if (!publicKey) {
        throw new BadRequestException('Unknown offline card identifier');
      }

      const expiresAtDate = new Date(expiresAtRaw);
      if (Number.isNaN(expiresAtDate.getTime())) {
        throw new BadRequestException('expiresAt must be a valid ISO 8601 timestamp');
      }
      const now = Date.now();
      if (expiresAtDate.getTime() <= now) {
        throw new ConflictException('Offline voucher has expired');
      }

      const payload = createOfflineVoucherPayload({
        id,
        fromCardId,
        toAccountId,
        amount: { currency, value: amountValue },
        nonce,
        expiresAt: expiresAtRaw,
      });
      const signatureBytes = hexToBytes(signature);
      const isValid = ed25519.verify(signatureBytes, payload, publicKey);
      if (!isValid) {
        throw new UnauthorizedException('Offline voucher signature is invalid');
      }

      const amount = this.parsePositiveAmount(amountValue);
      const createdAt = new Date(now).toISOString();
      const record: OfflineVoucherRecord = {
        id,
        fromCardId,
        toAccountId,
        currency,
        amount,
        nonce,
        signature: signature.toLowerCase(),
        expiresAt: expiresAtDate.toISOString(),
        status: 'pending',
        createdAt,
      } satisfies OfflineVoucherRecord;

      this.offlineVouchers.set(id, record);
      this.offlineVoucherNonces.set(nonceKey, id);

      return this.toOfflineVoucher(record);
    });
  }

  redeemOfflineVoucher(id: string, actor: Request): OfflineVoucher {
    const context = this.security.validateMutation(actor, undefined);
    const user = this.requireUser(actor);
    return this.security.applyIdempotency(context, () => {
      const normalizedId = id?.trim();
      if (!normalizedId) {
        throw new BadRequestException('id is required');
      }

      const record = this.requireOfflineVoucher(normalizedId);
      if (record.status === 'redeemed') {
        throw new ConflictException('Offline voucher already redeemed');
      }

      const expiresAt = new Date(record.expiresAt);
      if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
        throw new ConflictException('Offline voucher has expired');
      }

      const account = this.requireAccount(record.toAccountId);
      if (account.ownerId !== user.id) {
        throw new ForbiddenException('You do not have access to this account');
      }

      const redeemedAt = new Date().toISOString();
      account.balance = this.round(account.balance + record.amount);
      account.updatedAt = redeemedAt;
      record.status = 'redeemed';
      record.redeemedAt = redeemedAt;

      const transaction: Transaction = {
        id: this.buildId('txn', this.transactionSequence++),
        accountId: account.id,
        type: 'credit',
        status: 'posted',
        amount: this.monetary(record.amount, record.currency),
        createdAt: redeemedAt,
        metadata: {
          direction: 'incoming',
          offlineVoucherId: record.id,
          fromCardId: record.fromCardId,
        },
      } satisfies Transaction;

      this.prependTransaction(account.id, transaction);

      return this.toOfflineVoucher(record);
    });
  }

  retryFailedTransactions(): void {
    const failures = Array.from(this.deadLetterQueue.values());
    for (const failure of failures) {
      const journal = this.transactionJournals.get(failure.scope);
      if (!journal) {
        this.deadLetterQueue.delete(failure.scope);
        continue;
      }

      try {
        this.executeTransactionJournal(journal);
        if (journal.status === 'posted') {
          this.deadLetterQueue.delete(failure.scope);
        }
      } catch (error) {
        journal.lastError = this.normalizeError(error);
        const existing = this.deadLetterQueue.get(failure.scope);
        if (existing) {
          existing.failedAt = new Date().toISOString();
          existing.error = journal.lastError;
          existing.attempts = journal.attempts;
        }
      }
    }
  }

  getDeadLetterQueueSnapshot(): DeadLetterRecord[] {
    return Array.from(this.deadLetterQueue.values()).map((entry) => ({
      scope: entry.scope,
      jobKind: entry.jobKind,
      failedAt: entry.failedAt,
      attempts: entry.attempts,
      error: { ...entry.error },
      snapshot: { ...entry.snapshot },
    }));
  }

  simulateCrashOnNextTransaction(): void {
    this.crashNextTransaction = true;
  }

  runNightlyReconciliation(): void {
    const now = Date.now();
    for (const account of this.accounts.values()) {
      const recomputed = this.computeAccountBalanceFromHistory(account);
      const roundedRecomputed = this.round(recomputed);
      const roundedActual = this.round(account.balance);
      if (Math.abs(roundedRecomputed - roundedActual) > 0.005) {
        this.maybeRaiseAlert(
          'balance_mismatch',
          'high',
          now,
          {
            accountId: account.id,
            expectedBalance: roundedRecomputed.toFixed(2),
            actualBalance: roundedActual.toFixed(2),
          },
          `balance_mismatch:${account.id}`,
        );
      }
    }
  }

  debugSetAccountBalance(accountId: string, newBalance: number): void {
    const account = this.requireAccount(accountId);
    account.balance = this.round(newBalance);
    account.updatedAt = new Date().toISOString();
  }

  listAdminAlerts(actor: Request): Alert[] {
    this.requireUser(actor);
    return this.alertOrder
      .map((id) => this.alerts.get(id))
      .filter((record): record is AlertRecord => {
        if (!record) {
          return false;
        }
        return !record.acknowledged;
      })
      .map((record) => this.toAlert(record));
  }

  acknowledgeAlert(id: string, actor: Request): void {
    const requestLike = actor as Partial<Request> & { body?: unknown };
    const context = this.security.validateMutation(actor, requestLike.body);
    this.requireUser(actor);
    this.security.applyIdempotency(context, () => {
      const normalizedId = id?.trim();
      if (!normalizedId) {
        throw new BadRequestException('id is required');
      }

      const record = this.requireAlert(normalizedId);
      if (!record.acknowledged) {
        record.acknowledged = true;
        this.activeAlertKeys.delete(record.key);
      }
    });
  }

  receiveSmsInbound(request: SmsInboundRequest, actor: Request): SmsInboundResponse {
    const context = this.security.validateMutation(actor, request);
    return this.security.applyIdempotency(context, () => {
      const msisdn = this.normalizeMsisdn(request.from);
      const text = request.text?.trim();

      if (!msisdn) {
        throw new BadRequestException('from is required');
      }
      if (!text) {
        throw new BadRequestException('text is required');
      }

      const account = this.getOrCreateSmsAccount(msisdn);
      const reply = this.processSmsCommand(account, msisdn, text);

      return { reply } satisfies SmsInboundResponse;
    });
  }

  initiateTransfer(request: TransferRequest, actor: Request): Transaction {
    const context = this.security.validateMutation(actor, request);
    const user = this.requireUser(actor);
    const sourceId = request.sourceAccountId?.trim();
    const destinationId = request.destinationAccountId?.trim();
    const amountValue = request.amount?.value?.trim();
    const currency = request.amount?.currency?.trim() || DEFAULT_CURRENCY;

    if (!sourceId || !destinationId || !amountValue) {
      throw new BadRequestException('sourceAccountId, destinationAccountId, and amount are required');
    }

    const amount = Number.parseFloat(amountValue);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount must be a positive decimal string');
    }

    const sourceAccount = this.requireAccount(sourceId);
    if (sourceAccount.ownerId !== user.id) {
      throw new ForbiddenException('Transfers are limited to your accounts');
    }

    if (sourceAccount.currency !== currency) {
      throw new BadRequestException('Currency mismatch with source account');
    }

    if (sourceAccount.balance < amount) {
      throw new BadRequestException('Insufficient funds');
    }

    const destinationAccount = this.getOrCreateExternalAccount(destinationId, currency);
    const memo = request.memo?.trim();

    return this.processTransaction(context, () => {
      const snapshot: Record<string, unknown> = {
        sourceAccountId: sourceAccount.id,
        destinationAccountId: destinationAccount.id,
        amount,
        currency,
      };
      if (memo) {
        snapshot.memo = memo;
      }

      return {
        kind: 'transfer',
        snapshot,
        execute: (transactionId: string) => {
          const createdAt = new Date().toISOString();
          sourceAccount.balance = this.round(sourceAccount.balance - amount);
          sourceAccount.updatedAt = createdAt;
          destinationAccount.balance = this.round(destinationAccount.balance + amount);
          destinationAccount.updatedAt = createdAt;

          const metadata: Record<string, string> = { direction: 'outgoing' };
          if (memo) {
            metadata.memo = memo;
          }

          const transaction: Transaction = {
            id: transactionId,
            accountId: sourceAccount.id,
            counterpartyAccountId: destinationAccount.id,
            type: 'transfer',
            status: 'posted',
            amount: this.monetary(amount, currency),
            createdAt,
            metadata,
          } satisfies Transaction;

          const inboundMetadata: Record<string, string> = { ...metadata, direction: 'incoming' };

          this.prependTransaction(sourceAccount.id, transaction);
          this.prependTransaction(destinationAccount.id, {
            ...transaction,
            id: `${transactionId}_rcv`,
            accountId: destinationAccount.id,
            counterpartyAccountId: sourceAccount.id,
            amount: this.monetary(amount, currency),
            metadata: inboundMetadata,
          });

          this.recordTransferActivity(sourceAccount.id, amount, createdAt);

          return transaction;
        },
      } satisfies TransactionJob;
    });
  }

  createIssuanceRequest(request: IssueRequest, actor: Request): IssuanceRequest {
    const context = this.security.validateMutation(actor, request);
    const user = this.requireUser(actor);
    return this.security.applyIdempotency(context, () => {
      const accountId = request.accountId?.trim();
      const amountValue = request.amount?.value?.trim();

      if (!accountId || !amountValue) {
        throw new BadRequestException('accountId and amount are required');
      }

      const account = this.requireAccount(accountId);
      if (account.ownerId !== user.id) {
        throw new ForbiddenException('You do not have access to this account');
      }

      const currency = request.amount?.currency?.trim() || account.currency;
      if (currency !== account.currency) {
        throw new BadRequestException('Currency mismatch with account');
      }

      const amount = this.parsePositiveAmount(amountValue);
      const reference = request.reference?.trim() || undefined;

      const id = this.buildId('ir', this.issuanceSequence++);
      const record: IssuanceRequestRecord = {
        id,
        accountId,
        currency,
        amount,
        required: ISSUANCE_SIGNATURE_THRESHOLD,
        collected: new Set(),
        status: 'pending',
        reference,
      } satisfies IssuanceRequestRecord;

      this.issuanceRequests.set(id, record);
      this.issuanceOrder.unshift(id);

      return this.toIssuanceRequest(record);
    });
  }

  listIssuanceRequests(actor: Request): IssuanceRequest[] {
    this.requireUser(actor);
    return this.issuanceOrder.map((id) =>
      this.toIssuanceRequest(this.requireIssuanceRequest(id)),
    );
  }

  signIssuanceRequest(id: string, request: SignIssuanceRequestRequest, actor: Request): IssuanceRequest {
    const context = this.security.validateMutation(actor, request);
    this.requireUser(actor);
    return this.security.applyIdempotency(context, () => {
      const normalizedId = id?.trim();
      const normalizedValidator = request.validatorId?.trim();
      if (!normalizedId || !normalizedValidator) {
        throw new BadRequestException('id and validatorId are required');
      }

      const record = this.requireIssuanceRequest(normalizedId);
      if (record.status === 'completed') {
        throw new ConflictException('Issuance request already completed');
      }
      if (record.collected.has(normalizedValidator)) {
        throw new ConflictException('Validator has already signed this request');
      }

      record.collected.add(normalizedValidator);
      this.updateIssuanceStatus(record);

      return this.toIssuanceRequest(record);
    });
  }

  issueFromRequest(request: IssueTokensRequest, actor: Request): Transaction {
    const context = this.security.validateMutation(actor, request);
    const user = this.requireUser(actor);
    const normalizedId = request.requestId?.trim();
    if (!normalizedId) {
      throw new BadRequestException('requestId is required');
    }

    const record = this.requireIssuanceRequest(normalizedId);
    if (record.status === 'completed') {
      throw new ConflictException('Issuance request already completed');
    }
    if (record.collected.size < record.required) {
      throw new BadRequestException('Issuance request is not approved');
    }

    const account = this.requireAccount(record.accountId);
    if (account.ownerId !== user.id) {
      throw new ForbiddenException('You do not have access to this account');
    }

    return this.processTransaction(context, () => {
      const metadata: Record<string, string> = { requestId: record.id };
      if (record.reference) {
        metadata.reference = record.reference;
      }

      const snapshot: Record<string, unknown> = {
        accountId: account.id,
        amount: record.amount,
        currency: record.currency,
        requestId: record.id,
      };
      if (record.reference) {
        snapshot.reference = record.reference;
      }

      return {
        kind: 'issuance',
        snapshot,
        execute: (transactionId: string) => {
          const createdAt = new Date().toISOString();
          account.balance = this.round(account.balance + record.amount);
          account.updatedAt = createdAt;

          const transaction: Transaction = {
            id: transactionId,
            accountId: account.id,
            type: 'issuance',
            status: 'posted',
            amount: this.monetary(record.amount, record.currency),
            createdAt,
            metadata: { ...metadata, direction: 'incoming' },
          } satisfies Transaction;

          this.prependTransaction(account.id, transaction);
          return transaction;
        },
        onSuccess: () => {
          record.status = 'completed';
        },
        onRecovered: () => {
          record.status = 'completed';
        },
      } satisfies TransactionJob;
    });
  }

  private processSmsCommand(account: AccountRecord, msisdn: string, text: string): string {
    const trimmed = text.trim();
    if (!trimmed) {
      return 'Please send a command. Reply HELP for assistance.';
    }

    const [commandRaw, ...args] = trimmed.split(/\s+/);
    const command = commandRaw.toUpperCase();

    switch (command) {
      case 'BAL':
      case 'BALANCE':
        return `Balance: ${this.formatCurrency(account.balance, account.currency)}.`;
      case 'HELP':
        return 'Commands: BAL to view balance, SEND <amount> <phone> to transfer.';
      case 'SEND':
        return this.handleSmsSend(account, msisdn, args);
      default:
        return `Unknown command "${commandRaw}". Reply HELP for a list of commands.`;
    }
  }

  private handleSmsSend(account: AccountRecord, senderMsisdn: string, args: string[]): string {
    if (args.length < 2) {
      return 'Usage: SEND <amount> <phone> [memo]';
    }

    const amountRaw = args[0];
    const destinationRaw = args[1];
    const memo = args.slice(2).join(' ').trim();

    const amountValue = Number.parseFloat(amountRaw);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return 'Amount must be a positive number.';
    }

    const amount = this.round(amountValue);
    const destinationMsisdn = this.normalizeMsisdn(destinationRaw);
    if (!destinationMsisdn) {
      return 'Destination must be a valid phone number.';
    }

    const currency = account.currency;
    if (amount > account.balance) {
      return `Insufficient funds. Balance ${this.formatCurrency(account.balance, currency)}.`;
    }

    const destinationAccount = this.getOrCreateSmsAccount(destinationMsisdn);
    if (destinationAccount.id === account.id) {
      return 'You cannot send funds to your own number.';
    }

    const createdAt = new Date().toISOString();
    account.balance = this.round(account.balance - amount);
    account.updatedAt = createdAt;
    destinationAccount.balance = this.round(destinationAccount.balance + amount);
    destinationAccount.updatedAt = createdAt;

    const transactionId = this.buildId('txn', this.transactionSequence++);
    const metadata: Record<string, string> = {
      channel: 'sms',
      senderMsisdn,
      recipientMsisdn: destinationMsisdn,
      direction: 'outgoing',
    };
    if (memo) {
      metadata.memo = memo;
    }

    const debitTransaction: Transaction = {
      id: transactionId,
      accountId: account.id,
      counterpartyAccountId: destinationAccount.id,
      type: 'transfer',
      status: 'posted',
      amount: this.monetary(amount, currency),
      createdAt,
      metadata,
    } satisfies Transaction;

    const creditTransaction: Transaction = {
      ...debitTransaction,
      id: `${transactionId}_rcv`,
      accountId: destinationAccount.id,
      counterpartyAccountId: account.id,
      amount: this.monetary(amount, destinationAccount.currency),
      metadata: { ...metadata, direction: 'incoming' },
    } satisfies Transaction;

    this.prependTransaction(account.id, debitTransaction);
    this.prependTransaction(destinationAccount.id, creditTransaction);

    return `Sent ${this.formatCurrency(amount, currency)} to ${destinationMsisdn}. New balance ${this.formatCurrency(account.balance, currency)}.`;
  }

  private getOrCreateSmsAccount(msisdn: string): AccountRecord {
    const existingId = this.smsAccounts.get(msisdn);
    if (existingId) {
      return this.requireAccount(existingId);
    }

    const accountId = this.buildId('acct', this.accountSequence++);
    const now = new Date().toISOString();
    const record: AccountRecord = {
      id: accountId,
      ownerId: `sms_${msisdn}`,
      ownerName: `SMS ${msisdn}`,
      status: 'ACTIVE',
      kycLevel: 'BASIC',
      createdAt: now,
      currency: DEFAULT_CURRENCY,
      balance: DEFAULT_BALANCE,
      updatedAt: now,
      openingBalance: DEFAULT_BALANCE,
    } satisfies AccountRecord;

    this.accounts.set(accountId, record);
    this.transactions.set(accountId, []);
    this.smsAccounts.set(msisdn, accountId);

    return record;
  }

  private normalizeMsisdn(input?: string): string | undefined {
    if (typeof input !== 'string') {
      return undefined;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      return undefined;
    }

    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) {
      return undefined;
    }

    return hasPlus ? `+${digits}` : digits;
  }

  private formatCurrency(amount: number, currency: string): string {
    return `${currency} ${amount.toFixed(2)}`;
  }

  private requireAccount(accountId: string): AccountRecord {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  private requireUser(request: Request): UserRecord {
    const headers = (request as unknown as { headers?: Record<string, unknown> }).headers ?? {};
    const authHeaderValue = headers['authorization'] ?? headers['Authorization'];
    const authHeader =
      typeof authHeaderValue === 'string'
        ? authHeaderValue
        : Array.isArray(authHeaderValue)
          ? authHeaderValue[0]
          : undefined;
    if (typeof authHeader !== 'string' || !authHeader.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = authHeader.slice(7).trim();
    const record = this.tokens.get(token);
    if (!record || record.expiresAt <= Date.now()) {
      throw new UnauthorizedException('Invalid or expired session');
    }
    const user = this.usersById.get(record.userId);
    if (!user) {
      throw new UnauthorizedException('Session user no longer exists');
    }
    return user;
  }

  private requireIssuanceRequest(id: string): IssuanceRequestRecord {
    const record = this.issuanceRequests.get(id);
    if (!record) {
      throw new NotFoundException('Issuance request not found');
    }
    return record;
  }

  private recordTransferActivity(accountId: string, amount: number, createdAtIso: string): void {
    const timestamp = Date.parse(createdAtIso);
    if (!Number.isFinite(timestamp)) {
      return;
    }

    const retentionWindow = Math.max(STRUCTURING_WINDOW_MS, VELOCITY_WINDOW_MS);
    const events = this.transferEvents.get(accountId) ?? [];
    events.push({ amount, timestamp });

    while (events.length > 0 && timestamp - events[0]!.timestamp > retentionWindow) {
      events.shift();
    }

    this.transferEvents.set(accountId, events);

    this.evaluateStructuring(accountId, events, timestamp);
    this.evaluateVelocity(accountId, events, timestamp);
  }

  private evaluateStructuring(accountId: string, events: TransferEvent[], now: number): void {
    const recent = events.filter((event) => now - event.timestamp <= STRUCTURING_WINDOW_MS);
    const suspicious = recent.filter(
      (event) =>
        event.amount < STRUCTURING_THRESHOLD &&
        event.amount >= STRUCTURING_THRESHOLD - STRUCTURING_MARGIN,
    );

    if (suspicious.length >= STRUCTURING_COUNT) {
      const totalValue = suspicious.reduce((sum, event) => sum + event.amount, 0);
      this.maybeRaiseAlert(
        'structuring',
        'high',
        now,
        {
          accountId,
          transferCount: suspicious.length,
          totalValue: this.round(totalValue),
          windowMinutes: Math.ceil(STRUCTURING_WINDOW_MS / 60000),
        },
        `structuring:${accountId}`,
      );
    }
  }

  private evaluateVelocity(accountId: string, events: TransferEvent[], now: number): void {
    const recent = events.filter((event) => now - event.timestamp <= VELOCITY_WINDOW_MS);
    if (recent.length >= VELOCITY_COUNT) {
      this.maybeRaiseAlert(
        'velocity',
        'medium',
        now,
        {
          accountId,
          transferCount: recent.length,
          windowMinutes: Math.ceil(VELOCITY_WINDOW_MS / 60000),
        },
        `velocity:${accountId}`,
      );
    }
  }

  private recordAccountCreation(accountId: string, createdAtIso: string): void {
    const timestamp = Date.parse(createdAtIso);
    if (!Number.isFinite(timestamp)) {
      return;
    }

    this.accountCreationEvents.push({ accountId, timestamp });
    const windowStart = timestamp - NEW_ACCOUNT_WINDOW_MS;
    while (this.accountCreationEvents.length > 0 && this.accountCreationEvents[0]!.timestamp < windowStart) {
      this.accountCreationEvents.shift();
    }

    if (this.accountCreationEvents.length >= NEW_ACCOUNT_THRESHOLD) {
      this.maybeRaiseAlert(
        'new_account_burst',
        'medium',
        timestamp,
        {
          accountIds: this.accountCreationEvents.map((event) => event.accountId),
          count: this.accountCreationEvents.length,
          windowMinutes: Math.ceil(NEW_ACCOUNT_WINDOW_MS / 60000),
        },
        'new_account_burst',
      );
    }
  }

  private maybeRaiseAlert(
    rule: string,
    severity: AlertSeverity,
    timestampMs: number,
    details: Record<string, unknown>,
    key: string,
  ): void {
    if (this.activeAlertKeys.has(key)) {
      return;
    }

    const id = this.buildId('alert', this.alertSequence++);
    const ts = new Date(timestampMs).toISOString();
    const normalizedDetails = { ...details };
    const record: AlertRecord = {
      id,
      severity,
      rule,
      ts,
      details: normalizedDetails,
      acknowledged: false,
      key,
    };

    this.alerts.set(id, record);
    this.alertOrder.unshift(id);
    this.activeAlertKeys.add(key);
  }

  private toAlert(record: AlertRecord): Alert {
    const details = Object.keys(record.details).length > 0 ? { ...record.details } : undefined;
    return {
      id: record.id,
      severity: record.severity,
      rule: record.rule,
      ts: record.ts,
      details,
    } satisfies Alert;
  }

  private requireAlert(id: string): AlertRecord {
    const record = this.alerts.get(id);
    if (!record) {
      throw new NotFoundException('Alert not found');
    }
    return record;
  }

  private requireVoucher(code: string): VoucherRecord {
    const voucher = this.vouchers.get(code);
    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }
    return voucher;
  }

  private requireOfflineVoucher(id: string): OfflineVoucherRecord {
    const voucher = this.offlineVouchers.get(id);
    if (!voucher) {
      throw new NotFoundException('Offline voucher not found');
    }
    return voucher;
  }

  private issueToken(userId: string): string {
    const token = this.generateToken();
    this.tokens.set(token, { token, userId, expiresAt: Date.now() + TOKEN_TTL_MS });
    return token;
  }

  private generateToken(): string {
    if (typeof randomUUID === 'function') {
      return `tok_${randomUUID()}`;
    }
    return `tok_${randomBytes(16).toString('hex')}`;
  }

  private generateVoucherCode(): string {
    return this.buildId('vch', this.voucherSequence++);
  }

  private toAccount(account: AccountRecord): Account {
    return {
      id: account.id,
      ownerId: account.ownerId,
      ownerName: account.ownerName,
      status: account.status,
      kycLevel: account.kycLevel,
      createdAt: account.createdAt,
      metadata: {},
    } satisfies Account;
  }

  private toBalance(account: AccountRecord): Balance {
    return {
      accountId: account.id,
      currency: account.currency,
      available: this.monetary(account.balance, account.currency),
      total: this.monetary(account.balance, account.currency),
      updatedAt: account.updatedAt,
    } satisfies Balance;
  }

  private toVoucher(record: VoucherRecord): Voucher {
    const metadata = Object.keys(record.metadata).length > 0 ? { ...record.metadata } : undefined;
    return {
      code: record.code,
      accountId: record.accountId,
      amount: this.monetary(record.amount, record.currency),
      fee: this.monetary(record.fee, record.currency),
      totalDebited: this.monetary(this.round(record.amount + record.fee), record.currency),
      status: record.status,
      createdAt: record.createdAt,
      redeemedAt: record.redeemedAt,
      metadata,
    } satisfies Voucher;
  }

  private toOfflineVoucher(record: OfflineVoucherRecord): OfflineVoucher {
    return {
      id: record.id,
      fromCardId: record.fromCardId,
      toAccountId: record.toAccountId,
      amount: this.monetary(record.amount, record.currency),
      nonce: record.nonce,
      signature: record.signature,
      expiresAt: record.expiresAt,
      status: record.status,
    } satisfies OfflineVoucher;
  }

  private monetary(amount: number, currency: string): MonetaryAmount {
    return { currency, value: amount.toFixed(2) } satisfies MonetaryAmount;
  }

  private processTransaction(
    context: ValidatedMutationContext,
    jobFactory: () => TransactionJob,
  ): Transaction {
    const job = jobFactory();
    const journal = this.getOrCreateTransactionJournal(context, job);
    journal.job = job;

    return this.security.applyIdempotency(context, () => this.executeTransactionJournal(journal));
  }

  private getOrCreateTransactionJournal(
    context: ValidatedMutationContext,
    job: TransactionJob,
  ): TransactionJournalRecord {
    const existing = this.transactionJournals.get(context.scope);
    if (existing) {
      if (existing.bodyHash !== context.bodyHash) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Idempotency key has already been used with a different payload.',
        });
      }
      return existing;
    }

    const record: TransactionJournalRecord = {
      scope: context.scope,
      bodyHash: context.bodyHash,
      transactionId: this.buildId('txn', this.transactionSequence++),
      status: 'pending',
      attempts: 0,
      job,
    };

    this.transactionJournals.set(context.scope, record);
    return record;
  }

  private executeTransactionJournal(journal: TransactionJournalRecord): TransactionRecord {
    journal.attempts += 1;
    const existing = this.findTransactionRecord(journal.transactionId);
    if (existing && journal.status !== 'posted') {
      const recovered = this.cloneTransaction(existing);
      journal.status = 'posted';
      journal.response = recovered;
      journal.lastError = undefined;
      this.deadLetterQueue.delete(journal.scope);
      journal.job?.onRecovered?.(recovered);
      return this.cloneTransaction(recovered);
    }

    const job = journal.job;
    if (!job) {
      throw new Error('No transaction job registered for execution.');
    }

    try {
      const result = job.execute(journal.transactionId);
      const transaction = this.cloneTransaction(result);

      if (this.crashNextTransaction) {
        this.crashNextTransaction = false;
        throw new Error('Simulated transaction crash');
      }

      journal.status = 'posted';
      journal.response = transaction;
      journal.lastError = undefined;
      this.deadLetterQueue.delete(journal.scope);
      job.onSuccess?.(transaction);
      return this.cloneTransaction(transaction);
    } catch (error) {
      journal.status = 'failed';
      this.crashNextTransaction = false;
      const normalized = this.normalizeError(error);
      journal.lastError = normalized;
      this.enqueueDeadLetter(journal, normalized);
      throw error;
    } finally {
      this.crashNextTransaction = false;
    }
  }

  private enqueueDeadLetter(journal: TransactionJournalRecord, error: DeadLetterError): void {
    const failedAt = new Date().toISOString();
    const job = journal.job;
    if (!job) {
      return;
    }

    const existing = this.deadLetterQueue.get(journal.scope);
    if (existing) {
      existing.failedAt = failedAt;
      existing.attempts = journal.attempts;
      existing.error = error;
      return;
    }

    this.deadLetterQueue.set(journal.scope, {
      scope: journal.scope,
      jobKind: job.kind,
      failedAt,
      attempts: journal.attempts,
      error,
      snapshot: { ...job.snapshot },
    });
  }

  private computeAccountBalanceFromHistory(account: AccountRecord): number {
    const history = this.transactions.get(account.id) ?? [];
    let running = account.openingBalance;
    for (const entry of history.slice().reverse()) {
      running = this.round(running + this.calculateTransactionDelta(entry, account.id));
    }
    return running;
  }

  private calculateTransactionDelta(transaction: TransactionRecord, accountId: string): number {
    const raw = transaction.amount?.value;
    if (typeof raw !== 'string') {
      return 0;
    }
    const amount = Number.parseFloat(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0;
    }

    switch (transaction.type) {
      case 'credit':
      case 'issuance':
      case 'redemption':
        return this.round(amount);
      case 'debit':
        return this.round(-amount);
      case 'transfer': {
        const direction = this.getTransactionDirection(transaction, accountId);
        return direction === 'incoming' ? this.round(amount) : this.round(-amount);
      }
      default:
        return 0;
    }
  }

  private getTransactionDirection(
    transaction: TransactionRecord,
    accountId: string,
  ): 'incoming' | 'outgoing' {
    const metadata = transaction.metadata ?? {};
    const directionRaw = typeof metadata.direction === 'string' ? metadata.direction.toLowerCase() : undefined;
    if (directionRaw === 'incoming' || directionRaw === 'outgoing') {
      return directionRaw;
    }
    if (transaction.accountId === accountId && transaction.counterpartyAccountId === accountId) {
      return 'incoming';
    }
    if (transaction.accountId === accountId) {
      return 'outgoing';
    }
    return 'incoming';
  }

  private findTransactionRecord(transactionId: string): TransactionRecord | undefined {
    for (const history of this.transactions.values()) {
      const found = history.find((entry) => entry.id === transactionId);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  private cloneTransaction(transaction: TransactionRecord): TransactionRecord {
    if (typeof globalThis.structuredClone === 'function') {
      return structuredClone(transaction);
    }
    return JSON.parse(JSON.stringify(transaction)) as TransactionRecord;
  }

  private normalizeError(error: unknown): DeadLetterError {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } satisfies DeadLetterError;
    }
    if (typeof error === 'string') {
      return { name: 'Error', message: error } satisfies DeadLetterError;
    }
    try {
      return {
        name: 'Error',
        message: JSON.stringify(error),
      } satisfies DeadLetterError;
    } catch {
      return { name: 'Error', message: 'Unknown error' } satisfies DeadLetterError;
    }
  }

  private toIssuanceRequest(record: IssuanceRequestRecord): IssuanceRequest {
    return {
      id: record.id,
      accountId: record.accountId,
      amount: this.monetary(record.amount, record.currency),
      required: record.required,
      collected: record.collected.size,
      status: record.status,
    } satisfies IssuanceRequest;
  }

  private getOrCreateExternalAccount(accountId: string, currency: string): AccountRecord {
    const existing = this.accounts.get(accountId);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const account: AccountRecord = {
      id: accountId,
      ownerId: 'external',
      ownerName: 'External counterparty',
      status: 'ACTIVE',
      kycLevel: 'BASIC',
      createdAt: now,
      currency,
      balance: 0,
      updatedAt: now,
      openingBalance: 0,
    };

    this.accounts.set(accountId, account);
    this.transactions.set(accountId, []);
    return account;
  }

  private prependTransaction(accountId: string, transaction: TransactionRecord): void {
    const history = this.transactions.get(accountId) ?? [];
    history.unshift(transaction);
    this.transactions.set(accountId, history);
    recordTransactionMetric(transaction);
  }

  private findCursorIndex(history: TransactionRecord[], cursor: string): number {
    const index = history.findIndex((entry) => entry.id === cursor);
    if (index === -1) {
      throw new BadRequestException('Invalid cursor');
    }
    return index;
  }

  private updateIssuanceStatus(record: IssuanceRequestRecord): void {
    if (record.status === 'completed') {
      return;
    }
    const collected = record.collected.size;
    if (collected === 0) {
      record.status = 'pending';
    } else if (collected < record.required) {
      record.status = 'collecting';
    } else {
      record.status = 'ready';
    }
  }

  private parsePositiveAmount(value: string): number {
    const amount = Number.parseFloat(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount must be a positive decimal string');
    }
    return this.round(amount);
  }

  private buildId(prefix: string, sequence: number): string {
    return `${prefix}_${sequence.toString().padStart(6, '0')}`;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

const fallbackBankService = new InMemoryBankService();

export function getFallbackBankService(): InMemoryBankService {
  return fallbackBankService;
}
