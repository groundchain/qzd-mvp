import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const IssueSchema = z
  .object({
    toAccountId: z.string().uuid(),
    amount: z.number().positive(),
    memo: z.string().max(140).optional(),
    approvals: z.array(z.string().uuid()).min(2)
  })
  .strict();

export class IssueDto extends createZodDto(IssueSchema) {}

export type IssueInput = z.infer<typeof IssueSchema>;
