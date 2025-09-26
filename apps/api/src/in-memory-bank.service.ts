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
  Account,
  Balance,
  CreateAccountRequest,
  IssueRequest,
  IssuanceRequest,
  ListAccountTransactions200Response,
  LoginUser200Response,
  LoginUserRequest,
  MonetaryAmount,
  RegisterUser201Response,
  RegisterUserRequest,
  Transaction,
  TransferRequest,
  UploadAccountKycRequest,
} from '@qzd/sdk-api/server';

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

const DEFAULT_BALANCE = 1_000;
const TOKEN_TTL_MS = 60 * 60 * 1000;
const DEFAULT_CURRENCY = 'QZD';
const ISSUANCE_SIGNATURE_THRESHOLD = 2;

@Injectable()
export class InMemoryBankService {
  private readonly usersByEmail = new Map<string, UserRecord>();
  private readonly usersById = new Map<string, UserRecord>();
  private readonly accounts = new Map<string, AccountRecord>();
  private readonly transactions = new Map<string, TransactionRecord[]>();
  private readonly tokens = new Map<string, TokenRecord>();
  private readonly issuanceRequests = new Map<string, IssuanceRequestRecord>();
  private readonly issuanceOrder: string[] = [];

  private userSequence = 1;
  private accountSequence = 1;
  private transactionSequence = 1;
  private issuanceSequence = 1;

  registerUser(request: RegisterUserRequest): RegisterUser201Response {
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

    const token = this.issueToken(userId);

    return {
      userId,
      account: this.toAccount(account),
      token,
    } satisfies RegisterUser201Response;
  }

  loginUser(request: LoginUserRequest): LoginUser200Response {
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
  }

  createAccount(request: CreateAccountRequest, actor: Request): Account {
    const user = this.requireUser(actor);
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

    return this.toAccount(account);
  }

  updateAccountKyc(request: UploadAccountKycRequest, actor: Request): Account {
    const user = this.requireUser(actor);
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

  initiateTransfer(request: TransferRequest, actor: Request): Transaction {
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

    return transaction;
  }

  createIssuanceRequest(request: IssueRequest, actor: Request): IssuanceRequest {
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
  }

  listIssuanceRequests(actor: Request): IssuanceRequest[] {
    this.requireUser(actor);
    return this.issuanceOrder.map((id) =>
      this.toIssuanceRequest(this.requireIssuanceRequest(id)),
    );
  }

  signIssuanceRequest(id: string, validatorId: string, actor: Request): IssuanceRequest {
    this.requireUser(actor);

    const normalizedId = id?.trim();
    const normalizedValidator = validatorId?.trim();
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
  }

  issueFromRequest(requestId: string, actor: Request): Transaction {
    const user = this.requireUser(actor);
    const normalizedId = requestId?.trim();
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
