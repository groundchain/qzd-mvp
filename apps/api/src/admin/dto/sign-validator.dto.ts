import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SignValidatorSchema = z
  .object({
    validatorId: z.string().uuid(),
    payload: z.string().min(1)
  })
  .strict();

export class SignValidatorDto extends createZodDto(SignValidatorSchema) {}

export type SignValidatorInput = z.infer<typeof SignValidatorSchema>;
