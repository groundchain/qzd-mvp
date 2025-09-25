import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { LoginInput } from './dto/login.dto.js';
import { RegisterInput } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  async register(dto: RegisterInput) {
    return {
      accountId: crypto.randomUUID(),
      phone: dto.phone,
      status: 'otp_sent'
    } as const;
  }

  async login(dto: LoginInput) {
    return {
      accessToken: `mock-token-${dto.phone}`,
      tokenType: 'bearer',
      expiresIn: 3600
    } as const;
  }
}
