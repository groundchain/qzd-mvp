import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RegisterSchema = z
  .object({
    phone: z.string().min(8).max(16),
    dpi: z.string().min(6).max(32),
    otpChannel: z.enum(['sms', 'whatsapp']).default('sms')
  })
  .strict();

export class RegisterDto extends createZodDto(RegisterSchema) {}

export type RegisterInput = z.infer<typeof RegisterSchema>;
