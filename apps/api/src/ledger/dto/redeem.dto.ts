import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RedeemSchema = z
  .object({
    accountId: z.string().uuid(),
    amount: z.number().positive(),
    memo: z.string().max(140).optional(),
    agentId: z.string().uuid().optional()
  })
  .strict();

export class RedeemDto extends createZodDto(RedeemSchema) {}

export type RedeemInput = z.infer<typeof RedeemSchema>;
