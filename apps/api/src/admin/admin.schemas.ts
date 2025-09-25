import { z } from 'zod';
import type { SignValidatorRequest } from '../../generated/server/model/signValidatorRequest.js';

export const signValidatorSchema: z.ZodType<SignValidatorRequest> = z
  .object({
    validatorId: z.string().uuid(),
    payload: z.string().trim().min(16),
    expiresAt: z.string().datetime().optional()
  })
  .strict();
