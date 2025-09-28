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
import { RequestSecurityManager } from './request-security.js';

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
  private readonly smsAccounts = new Map<string, string>();
  private readonly security = new RequestSecurityManager();
  private readonly alerts = new Map<string, AlertRecord>();
  private readonly alertOrder: string[] = [];
  private readonly activeAlertKeys = new Set<string>();
  private readonly transferEvents = new Map<string, TransferEvent[]>();
  private readonly accountCreationEvents: AccountCreationEvent[] = [];

  private userSequence = 1;
  private accountSequence = 1;
  private transactionSequence = 1;
  private issuanceSequence = 1;
  private voucherSequence = 1;
  private alertSequence = 1;

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
      const createdAt = new Date().toISOString();

      account.balance = this.round(account.balance + amount);
      account.updatedAt = createdAt;

      const memo = request.memo?.trim();
      const metadata: Record<string, string> = {};
      if (memo) {
        metadata.memo = memo;
      }

      const transaction: Transaction = {
        id: this.buildId('txn', this.transactionSequence++),
        accountId: account.id,
        type: 'credit',
        status: 'posted',
        amount: this.monetary(amount, currency),
        createdAt,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      } satisfies Transaction;

      this.prependTransaction(account.id, transaction);

      return transaction;
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
    return this.security.applyIdempotency(context, () => {
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
      const createdAt = new Date().toISOString();
      const transactionId = this.buildId('txn', this.transactionSequence++);

      sourceAccount.balance = this.round(sourceAccount.balance - amount);
      sourceAccount.updatedAt = createdAt;
      destinationAccount.balance = this.round(destinationAccount.balance + amount);
      destinationAccount.updatedAt = createdAt;

      const memo = request.memo?.trim();
      const transaction: Transaction = {
        id: transactionId,
        accountId: sourceAccount.id,
        counterpartyAccountId: destinationAccount.id,
        type: 'transfer',
        status: 'posted',
        amount: this.monetary(amount, currency),
        createdAt,
        metadata: memo ? { memo } : undefined,
      } satisfies Transaction;

      this.prependTransaction(sourceAccount.id, transaction);
      this.prependTransaction(destinationAccount.id, {
        ...transaction,
        id: `${transactionId}_rcv`,
        accountId: destinationAccount.id,
        counterpartyAccountId: sourceAccount.id,
        amount: this.monetary(amount, currency),
      });

      this.recordTransferActivity(sourceAccount.id, amount, createdAt);

      return transaction;
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
    return this.security.applyIdempotency(context, () => {
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

      const createdAt = new Date().toISOString();
      account.balance = this.round(account.balance + record.amount);
      account.updatedAt = createdAt;

      const transactionId = this.buildId('txn', this.transactionSequence++);
      const metadata: Record<string, string> = { requestId: record.id };
      if (record.reference) {
        metadata.reference = record.reference;
      }

      const transaction: Transaction = {
        id: transactionId,
        accountId: account.id,
        type: 'issuance',
        status: 'posted',
        amount: this.monetary(record.amount, record.currency),
        createdAt,
        metadata,
      } satisfies Transaction;

      this.prependTransaction(account.id, transaction);

      record.status = 'completed';

      return transaction;
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

  private monetary(amount: number, currency: string): MonetaryAmount {
    return { currency, value: amount.toFixed(2) } satisfies MonetaryAmount;
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
    };

    this.accounts.set(accountId, account);
    this.transactions.set(accountId, []);
    return account;
  }

  private prependTransaction(accountId: string, transaction: TransactionRecord): void {
    const history = this.transactions.get(accountId) ?? [];
    history.unshift(transaction);
    this.transactions.set(accountId, history);
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
