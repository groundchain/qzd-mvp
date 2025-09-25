import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import type { RegisterAcceptedResponse } from '../../generated/server/model/registerAcceptedResponse.js';
import type { RegisterRequest } from '../../generated/server/model/registerRequest.js';
import type { LoginRequest } from '../../generated/server/model/loginRequest.js';
import type { LoginResponse } from '../../generated/server/model/loginResponse.js';

@Injectable()
export class AuthService {
  async register(dto: RegisterRequest): Promise<RegisterAcceptedResponse> {
    const ttlMinutes = dto.channel === 'phone' ? 5 : 10;
    return {
      registrationId: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000).toISOString()
    };
  }

  async login(dto: LoginRequest): Promise<LoginResponse> {
    const subject = crypto.createHash('sha256').update(dto.identifier).digest('hex');
    return {
      accessToken: `mock-access-${subject.slice(0, 24)}`,
      refreshToken: `mock-refresh-${subject.slice(24, 48)}`,
      expiresIn: 3600
    };
  }
}
