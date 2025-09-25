import { z } from 'zod';

export const AccountIdSchema = z
  .object({
    id: z.string().uuid()
  })
  .strict();
