import { z } from 'zod';
import type { LoginRequest } from '../../generated/server/model/loginRequest.js';
import type { RegisterRequest } from '../../generated/server/model/registerRequest.js';

export const registerSchema: z.ZodType<RegisterRequest> = z
  .object({
    channel: z.enum(['phone', 'dpi']),
    phoneNumber: z.string().trim().min(8).max(20).optional(),
    dpi: z.string().trim().min(6).max(32).optional(),
    otpCode: z.string().trim().min(4).max(12),
    metadata: z.record(z.string()).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.channel === 'phone' && !value.phoneNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'phoneNumber is required when channel is phone',
        path: ['phoneNumber']
      });
    }
    if (value.channel === 'dpi' && !value.dpi) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dpi is required when channel is dpi',
        path: ['dpi']
      });
    }
  });

export const loginSchema: z.ZodType<LoginRequest> = z
  .object({
    identifier: z.string().trim().min(3).max(64),
    otpCode: z.string().trim().min(4).max(12)
  })
  .strict();
