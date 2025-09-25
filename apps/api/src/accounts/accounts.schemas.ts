import { z } from 'zod';
import type { CreateAccountRequest } from '../../generated/server/model/createAccountRequest.js';

export const createAccountSchema: z.ZodType<CreateAccountRequest> = z
  .object({
    ownerId: z.string().uuid(),
    currency: z.string().trim().length(3).optional(),
    tags: z.array(z.string().trim().min(1)).max(50).optional(),
    metadata: z.record(z.string()).optional()
  })
  .strict();

export const accountIdSchema = z
  .object({
    accountId: z.string().uuid()
  })
  .strict();
