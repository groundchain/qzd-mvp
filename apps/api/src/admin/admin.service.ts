import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import type { SignValidatorRequest } from '../../generated/server/model/signValidatorRequest.js';
import type { SignValidatorResponse } from '../../generated/server/model/signValidatorResponse.js';
import type { ValidatorsResponse } from '../../generated/server/model/validatorsResponse.js';
import type { Validator } from '../../generated/server/model/validator.js';

@Injectable()
export class AdminService {
  async listValidators(): Promise<ValidatorsResponse> {
    const validators: Validator[] = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Core Validator',
        publicKey: 'mock-core-key',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Community Validator',
        publicKey: 'mock-community-key',
        status: 'pending',
        createdAt: new Date(Date.now() - 86_400_000).toISOString()
      }
    ];

    return { items: validators };
  }

  async sign(dto: SignValidatorRequest): Promise<SignValidatorResponse> {
    return {
      validatorId: dto.validatorId,
      signature: crypto.createHash('sha256').update(dto.payload).digest('hex'),
      signedAt: new Date().toISOString(),
      keyId: 'admin-sim'
    };
  }
}
