import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { SignValidatorInput } from './dto/sign-validator.dto.js';

@Injectable()
export class AdminService {
  async listValidators() {
    return [
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Core Validator',
        status: 'active'
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Community Validator',
        status: 'pending'
      }
    ] as const;
  }

  async sign(dto: SignValidatorInput) {
    return {
      validatorId: dto.validatorId,
      signature: crypto.createHash('sha256').update(dto.payload).digest('hex')
    } as const;
  }
}
