import { z } from 'zod';
import type { AcquireRemittanceRequest } from '../../generated/server/model/acquireRemittanceRequest.js';

export const acquireRemittanceSchema: z.ZodType<AcquireRemittanceRequest> = z
  .object({
    usdAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'usdAmount must be a decimal string'),
    beneficiaryAccountId: z.string().uuid(),
    senderName: z.string().trim().min(2).max(80).optional(),
    senderCountry: z.string().trim().length(2).optional(),
    fxRate: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(),
    metadata: z.record(z.string()).optional()
  })
  .strict();
