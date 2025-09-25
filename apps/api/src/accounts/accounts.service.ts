import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAccountInput } from './dto/create-account.dto.js';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAccount(dto: CreateAccountInput) {
    return {
      accountId: crypto.randomUUID(),
      phone: dto.phone,
      displayName: dto.displayName,
      status: 'pending_kyc'
    } as const;
  }

  async getBalance(accountId: string) {
    return {
      accountId,
      currency: 'QZD',
      balance: '0.00',
      lastUpdated: new Date().toISOString()
    } as const;
  }

  async getHistory(accountId: string) {
    return {
      accountId,
      entries: []
    } as const;
  }
}
