import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const TransferSchema = z
  .object({
    fromAccountId: z.string().uuid(),
    toAccountId: z.string().uuid(),
    amount: z.number().positive(),
    memo: z.string().max(140).optional()
  })
  .strict();

export class TransferDto extends createZodDto(TransferSchema) {}

export type TransferInput = z.infer<typeof TransferSchema>;
