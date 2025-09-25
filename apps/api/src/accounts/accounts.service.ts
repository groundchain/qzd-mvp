import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateAccountRequest } from '../../generated/server/model/createAccountRequest.js';
import type { Account } from '../../generated/server/model/account.js';
import type { AccountBalance } from '../../generated/server/model/accountBalance.js';
import type { LedgerEntry } from '../../generated/server/model/ledgerEntry.js';
import type { LedgerHistoryResponse } from '../../generated/server/model/ledgerHistoryResponse.js';

@Injectable()
export class AccountsService {
  constructor(private readonly _prisma: PrismaService) {}

  async createAccount(dto: CreateAccountRequest): Promise<Account> {
    return {
      id: crypto.randomUUID(),
      ownerId: dto.ownerId,
      currency: dto.currency ?? 'QZD',
      status: 'active',
      tags: dto.tags ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  async getBalance(accountId: string): Promise<AccountBalance> {
    return {
      accountId,
      currency: 'QZD',
      balance: '0.00',
      available: '0.00',
      holds: [],
      asOf: new Date().toISOString()
    };
  }

  async getHistory(accountId: string): Promise<LedgerHistoryResponse> {
    const sampleEntry: LedgerEntry = {
      id: crypto.randomUUID(),
      type: 'transfer',
      amount: '0.00',
      currency: 'QZD',
      direction: 'credit',
      createdAt: new Date().toISOString()
    };
    return {
      accountId,
      items: [sampleEntry],
      nextCursor: undefined
    };
  }
}
