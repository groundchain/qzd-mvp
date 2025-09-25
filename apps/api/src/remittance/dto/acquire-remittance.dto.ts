import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AcquireRemittanceSchema = z
  .object({
    senderName: z.string().min(1).max(64),
    amountUsd: z.number().positive(),
    destinationAccountId: z.string().uuid()
  })
  .strict();

export class AcquireRemittanceDto extends createZodDto(AcquireRemittanceSchema) {}

export type AcquireRemittanceInput = z.infer<typeof AcquireRemittanceSchema>;
