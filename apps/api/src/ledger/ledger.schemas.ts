import { z } from 'zod';
import type { IssueRequest } from '../../generated/server/model/issueRequest.js';
import type { RedeemRequest } from '../../generated/server/model/redeemRequest.js';
import type { TransferRequest } from '../../generated/server/model/transferRequest.js';

export const transferSchema: z.ZodType<TransferRequest> = z
  .object({
    fromAccountId: z.string().uuid(),
    toAccountId: z.string().uuid(),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'amount must be a decimal string'),
    memo: z.string().trim().max(140).optional(),
    idempotencyKey: z.string().trim().max(64).optional()
  })
  .strict();

export const issueSchema: z.ZodType<IssueRequest> = z
  .object({
    mintToAccountId: z.string().uuid(),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'amount must be a decimal string'),
    memo: z.string().trim().max(140).optional(),
    approvals: z
      .array(
        z
          .object({
            adminId: z.string().uuid(),
            signature: z.string().min(32),
            signedAt: z.string().datetime().optional()
          })
          .strict()
      )
      .min(1)
  })
  .strict();

export const redeemSchema: z.ZodType<RedeemRequest> = z
  .object({
    fromAccountId: z.string().uuid(),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'amount must be a decimal string'),
    destination: z
      .object({
        type: z.enum(['bank_transfer', 'cash_pickup']),
        bankAccount: z
          .object({
            routingNumber: z.string().trim().min(4).max(32),
            accountNumber: z.string().trim().min(4).max(32),
            holderName: z.string().trim().min(2).max(64).optional(),
            bankName: z.string().trim().min(2).max(64).optional()
          })
          .strict()
          .optional(),
        cashAgentCode: z.string().trim().min(2).max(32).optional()
      })
      .strict()
      .optional(),
    memo: z.string().trim().max(140).optional()
  })
  .strict();
