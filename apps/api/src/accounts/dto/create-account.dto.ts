import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateAccountSchema = z
  .object({
    phone: z.string().min(8).max(16),
    dpi: z.string().min(6).max(32),
    displayName: z.string().min(1).max(64)
  })
  .strict();

export class CreateAccountDto extends createZodDto(CreateAccountSchema) {}

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;
