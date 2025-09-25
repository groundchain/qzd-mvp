import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { TransferInput } from './dto/transfer.dto.js';
import { IssueInput } from './dto/issue.dto.js';
import { RedeemInput } from './dto/redeem.dto.js';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async transfer(dto: TransferInput) {
    return {
      transactionId: crypto.randomUUID(),
      type: 'transfer',
      fromAccountId: dto.fromAccountId,
      toAccountId: dto.toAccountId,
      amount: dto.amount,
      memo: dto.memo ?? null,
      status: 'completed'
    } as const;
  }

  async issue(dto: IssueInput) {
    return {
      transactionId: crypto.randomUUID(),
      type: 'issue',
      toAccountId: dto.toAccountId,
      approvals: dto.approvals,
      amount: dto.amount,
      memo: dto.memo ?? null,
      status: 'queued_for_settlement'
    } as const;
  }

  async redeem(dto: RedeemInput) {
    return {
      transactionId: crypto.randomUUID(),
      type: 'redeem',
      accountId: dto.accountId,
      agentId: dto.agentId ?? null,
      amount: dto.amount,
      memo: dto.memo ?? null,
      status: 'pending_release'
    } as const;
  }
}
