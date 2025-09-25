import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { TransferRequest } from '../../generated/server/model/transferRequest.js';
import type { IssueRequest } from '../../generated/server/model/issueRequest.js';
import type { RedeemRequest } from '../../generated/server/model/redeemRequest.js';
import type { LedgerSubmissionResponse } from '../../generated/server/model/ledgerSubmissionResponse.js';

@Injectable()
export class LedgerService {
  constructor(private readonly _prisma: PrismaService) {}

  async transfer(dto: TransferRequest): Promise<LedgerSubmissionResponse> {
    const submissionId = dto.idempotencyKey ?? crypto.randomUUID();
    return {
      submissionId,
      status: 'accepted',
      estimatedCompletion: new Date(Date.now() + 2 * 60_000).toISOString()
    };
  }

  async issue(dto: IssueRequest): Promise<LedgerSubmissionResponse> {
    const hasQuorum = dto.approvals.length >= 2;
    return {
      submissionId: crypto.randomUUID(),
      status: hasQuorum ? 'accepted' : 'pending',
      estimatedCompletion: hasQuorum
        ? new Date(Date.now() + 5 * 60_000).toISOString()
        : new Date(Date.now() + 10 * 60_000).toISOString()
    };
  }

  async redeem(dto: RedeemRequest): Promise<LedgerSubmissionResponse> {
    const status = dto.destination?.type === 'cash_pickup' ? 'pending' : 'accepted';
    return {
      submissionId: crypto.randomUUID(),
      status
    };
  }
}
