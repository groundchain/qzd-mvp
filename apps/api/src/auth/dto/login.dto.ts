import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LoginSchema = z
  .object({
    phone: z.string().min(8).max(16),
    otp: z.string().length(6)
  })
  .strict();

export class LoginDto extends createZodDto(LoginSchema) {}

export type LoginInput = z.infer<typeof LoginSchema>;
